const { Router } = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = Router();

// Helper: fetch a full request with all related data
async function fetchFullRequest(id) {
    const [requests] = await pool.query(
        `SELECT ir.*, u.id AS requestor_user_id, u.full_name AS requestor_full_name,
                u.email AS requestor_email, u.department AS requestor_department
         FROM intake_requests ir
         LEFT JOIN users u ON ir.requestor_id = u.id
         WHERE ir.id = ?`,
        [id]
    );
    if (requests.length === 0) return null;

    const request = requests[0];

    // Shape requestor
    request.requestor = {
        id: request.requestor_user_id,
        full_name: request.requestor_full_name,
        email: request.requestor_email,
        department: request.requestor_department
    };
    delete request.requestor_user_id;
    delete request.requestor_full_name;
    delete request.requestor_email;
    delete request.requestor_department;

    // Requestor info
    const [requestorInfo] = await pool.query(
        'SELECT * FROM requestor_info WHERE request_id = ?', [id]
    );
    request.requestor_info = requestorInfo.length > 0 ? requestorInfo[0] : null;

    // Project specs
    const [projectSpecs] = await pool.query(
        'SELECT * FROM project_specs WHERE request_id = ?', [id]
    );
    request.project_specs = projectSpecs.length > 0 ? projectSpecs[0] : null;

    // Scrub reviews
    const [scrubReviews] = await pool.query(
        `SELECT sr.*, u.id AS reviewer_user_id, u.full_name AS reviewer_full_name
         FROM scrub_reviews sr
         LEFT JOIN users u ON sr.reviewer_id = u.id
         WHERE sr.request_id = ?`,
        [id]
    );
    request.scrub_reviews = scrubReviews.map(r => ({
        ...r,
        reviewer: { id: r.reviewer_user_id, full_name: r.reviewer_full_name },
        reviewer_user_id: undefined,
        reviewer_full_name: undefined
    }));

    // Committee reviews
    const [committeeReviews] = await pool.query(
        `SELECT cr.*, u.id AS reviewer_user_id, u.full_name AS reviewer_full_name
         FROM committee_reviews cr
         LEFT JOIN users u ON cr.reviewer_id = u.id
         WHERE cr.request_id = ?`,
        [id]
    );
    request.committee_reviews = committeeReviews.map(r => ({
        ...r,
        reviewer: { id: r.reviewer_user_id, full_name: r.reviewer_full_name },
        reviewer_user_id: undefined,
        reviewer_full_name: undefined
    }));

    // Comments
    const [comments] = await pool.query(
        `SELECT c.*, u.id AS comment_user_id, u.full_name AS comment_user_full_name
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.request_id = ?
         ORDER BY c.created_at ASC`,
        [id]
    );
    request.comments = comments.map(c => ({
        ...c,
        user: { id: c.comment_user_id, full_name: c.comment_user_full_name },
        comment_user_id: undefined,
        comment_user_full_name: undefined
    }));

    // Attachments
    const [attachments] = await pool.query(
        'SELECT * FROM attachments WHERE request_id = ?', [id]
    );
    request.attachments = attachments;

    return request;
}

// GET /api/requests - List all requests (filtered by role)
router.get('/', authenticate, async (req, res) => {
    try {
        const conditions = [];
        const params = [];

        // Requestors only see their own requests
        if (req.user.role === 'requestor') {
            conditions.push('ir.requestor_id = ?');
            params.push(req.user.id);
        }

        // Filter by status if provided
        if (req.query.status) {
            conditions.push('ir.status = ?');
            params.push(req.query.status);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const [requests] = await pool.query(
            `SELECT ir.*, u.id AS requestor_user_id, u.full_name AS requestor_full_name, u.email AS requestor_email
             FROM intake_requests ir
             LEFT JOIN users u ON ir.requestor_id = u.id
             ${whereClause}
             ORDER BY ir.created_at DESC`,
            params
        );

        const result = requests.map(r => ({
            ...r,
            requestor: {
                id: r.requestor_user_id,
                full_name: r.requestor_full_name,
                email: r.requestor_email
            },
            requestor_user_id: undefined,
            requestor_full_name: undefined,
            requestor_email: undefined
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/requests/:id - Get single request with all related data
router.get('/:id', authenticate, async (req, res) => {
    try {
        const request = await fetchFullRequest(req.params.id);

        if (!request) {
            res.status(404).json({ error: 'Request not found' });
            return;
        }

        // Requestors can only see their own requests
        if (req.user.role === 'requestor' && request.requestor_id !== req.user.id) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        res.json(request);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/requests - Create a new request
router.post('/', authenticate, async (req, res) => {
    try {
        const {
            project_title, domain, estimated_budget, type_of_request,
            priority_level, date_of_submission, estimated_completion_date,
            requestor_info, project_specs
        } = req.body;

        if (!project_title) {
            res.status(400).json({ error: 'Project title is required' });
            return;
        }

        const [result] = await pool.query(
            `INSERT INTO intake_requests
             (project_title, domain, estimated_budget, type_of_request, priority_level,
              date_of_submission, estimated_completion_date, status, requestor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
            [project_title, domain || null, estimated_budget || null, type_of_request || null,
             priority_level || 'medium', date_of_submission || null,
             estimated_completion_date || null, req.user.id]
        );
        const requestId = result.insertId;

        // Create requestor info if provided
        if (requestor_info) {
            const ri = requestor_info;
            await pool.query(
                `INSERT INTO requestor_info (request_id, department, phone, manager_name, business_unit, cost_center)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [requestId, ri.department || null, ri.phone || null, ri.manager_name || null,
                 ri.business_unit || null, ri.cost_center || null]
            );
        }

        // Create project specs if provided
        if (project_specs) {
            const ps = project_specs;
            await pool.query(
                `INSERT INTO project_specs (request_id, description, business_justification, expected_outcomes,
                 technical_requirements, dependencies, risks)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [requestId, ps.description || null, ps.business_justification || null,
                 ps.expected_outcomes || null, ps.technical_requirements || null,
                 ps.dependencies || null, ps.risks || null]
            );
        }

        // Fetch full request
        const fullRequest = await fetchFullRequest(requestId);
        res.status(201).json(fullRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/requests/:id - Update a request
router.put('/:id', authenticate, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM intake_requests WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            res.status(404).json({ error: 'Request not found' });
            return;
        }
        const request = rows[0];

        // Only requestor who created it can edit, and only in draft/questions states
        if (request.requestor_id !== req.user.id && req.user.role !== 'admin') {
            res.status(403).json({ error: 'Only the requestor can edit this request' });
            return;
        }

        if (!['draft', 'scrub_questions', 'committee_questions'].includes(request.status)) {
            res.status(400).json({ error: 'Request can only be edited in draft or question states' });
            return;
        }

        const {
            project_title, domain, estimated_budget, type_of_request,
            priority_level, date_of_submission, estimated_completion_date,
            requestor_info, project_specs
        } = req.body;

        await pool.query(
            `UPDATE intake_requests SET project_title = ?, domain = ?, estimated_budget = ?,
             type_of_request = ?, priority_level = ?, date_of_submission = ?, estimated_completion_date = ?
             WHERE id = ?`,
            [project_title, domain || null, estimated_budget || null, type_of_request || null,
             priority_level || null, date_of_submission || null, estimated_completion_date || null,
             req.params.id]
        );

        // Update or create requestor info
        if (requestor_info) {
            const ri = requestor_info;
            const [existing] = await pool.query('SELECT id FROM requestor_info WHERE request_id = ?', [req.params.id]);
            if (existing.length > 0) {
                await pool.query(
                    `UPDATE requestor_info SET department = ?, phone = ?, manager_name = ?,
                     business_unit = ?, cost_center = ? WHERE request_id = ?`,
                    [ri.department || null, ri.phone || null, ri.manager_name || null,
                     ri.business_unit || null, ri.cost_center || null, req.params.id]
                );
            } else {
                await pool.query(
                    `INSERT INTO requestor_info (request_id, department, phone, manager_name, business_unit, cost_center)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [req.params.id, ri.department || null, ri.phone || null, ri.manager_name || null,
                     ri.business_unit || null, ri.cost_center || null]
                );
            }
        }

        // Update or create project specs
        if (project_specs) {
            const ps = project_specs;
            const [existing] = await pool.query('SELECT id FROM project_specs WHERE request_id = ?', [req.params.id]);
            if (existing.length > 0) {
                await pool.query(
                    `UPDATE project_specs SET description = ?, business_justification = ?, expected_outcomes = ?,
                     technical_requirements = ?, dependencies = ?, risks = ? WHERE request_id = ?`,
                    [ps.description || null, ps.business_justification || null, ps.expected_outcomes || null,
                     ps.technical_requirements || null, ps.dependencies || null, ps.risks || null, req.params.id]
                );
            } else {
                await pool.query(
                    `INSERT INTO project_specs (request_id, description, business_justification, expected_outcomes,
                     technical_requirements, dependencies, risks)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [req.params.id, ps.description || null, ps.business_justification || null,
                     ps.expected_outcomes || null, ps.technical_requirements || null,
                     ps.dependencies || null, ps.risks || null]
                );
            }
        }

        const fullRequest = await fetchFullRequest(req.params.id);
        res.json(fullRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
