const { Router } = require('express');
const { dbFetch, dbInsert, dbUpdate } = require('../services/dbClient');
const { authenticate } = require('../middleware/auth');

const router = Router();

// Helper: fetch a full request with all related data
async function fetchFullRequest(id) {
    const requests = await dbFetch('getRequestById', { id });
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
    const requestorInfo = await dbFetch('getRequestorInfoByRequestId', { request_id: id });
    request.requestor_info = requestorInfo.length > 0 ? requestorInfo[0] : null;

    // Project specs
    const projectSpecs = await dbFetch('getProjectSpecsByRequestId', { request_id: id });
    request.project_specs = projectSpecs.length > 0 ? projectSpecs[0] : null;

    // Scrub reviews
    const scrubReviews = await dbFetch('getScrubReviewsByRequestId', { request_id: id });
    request.scrub_reviews = scrubReviews.map(r => ({
        ...r,
        reviewer: { id: r.reviewer_user_id, full_name: r.reviewer_full_name },
        reviewer_user_id: undefined,
        reviewer_full_name: undefined
    }));

    // Committee reviews
    const committeeReviews = await dbFetch('getCommitteeReviewsByRequestId', { request_id: id });
    request.committee_reviews = committeeReviews.map(r => ({
        ...r,
        reviewer: { id: r.reviewer_user_id, full_name: r.reviewer_full_name },
        reviewer_user_id: undefined,
        reviewer_full_name: undefined
    }));

    // Comments
    const comments = await dbFetch('getCommentsByRequestId', { request_id: id });
    request.comments = comments.map(c => ({
        ...c,
        user: { id: c.user_id_ref, full_name: c.user_full_name },
        user_id_ref: undefined,
        user_full_name: undefined
    }));

    // Attachments
    const attachments = await dbFetch('getAttachmentsByRequestId', { request_id: id });
    request.attachments = attachments;

    return request;
}

// GET /api/requests - List all requests (filtered by role)
router.get('/', authenticate, async (req, res) => {
    try {
        let requests;

        if (req.user.role === 'requestor' && req.query.status) {
            requests = await dbFetch('getRequestsByRequestorAndStatus', {
                requestor_id: req.user.id,
                status: req.query.status
            });
        } else if (req.user.role === 'requestor') {
            requests = await dbFetch('getRequestsByRequestorId', {
                requestor_id: req.user.id
            });
        } else if (req.query.status) {
            requests = await dbFetch('getAllRequestsWithRequestorByStatus', {
                status: req.query.status
            });
        } else {
            requests = await dbFetch('getAllRequestsWithRequestor');
        }

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

        const result = await dbInsert('intake_requests', [{
            project_title,
            domain: domain || null,
            estimated_budget: estimated_budget || null,
            type_of_request: type_of_request || null,
            priority_level: priority_level || 'medium',
            date_of_submission: date_of_submission || null,
            estimated_completion_date: estimated_completion_date || null,
            status: 'draft',
            requestor_id: req.user.id
        }]);
        const requestId = result.insertId;

        // Create requestor info if provided
        if (requestor_info) {
            const ri = requestor_info;
            await dbInsert('requestor_info', [{
                request_id: requestId,
                department: ri.department || null,
                phone: ri.phone || null,
                manager_name: ri.manager_name || null,
                business_unit: ri.business_unit || null,
                cost_center: ri.cost_center || null
            }]);
        }

        // Create project specs if provided
        if (project_specs) {
            const ps = project_specs;
            await dbInsert('project_specs', [{
                request_id: requestId,
                description: ps.description || null,
                business_justification: ps.business_justification || null,
                expected_outcomes: ps.expected_outcomes || null,
                technical_requirements: ps.technical_requirements || null,
                dependencies: ps.dependencies || null,
                risks: ps.risks || null
            }]);
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
        const rows = await dbFetch('getSimpleRequestById', { id: req.params.id });
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

        await dbUpdate('intake_requests', {
            project_title,
            domain: domain || null,
            estimated_budget: estimated_budget || null,
            type_of_request: type_of_request || null,
            priority_level: priority_level || null,
            date_of_submission: date_of_submission || null,
            estimated_completion_date: estimated_completion_date || null
        }, { id: req.params.id });

        // Update or create requestor info
        if (requestor_info) {
            const ri = requestor_info;
            const existing = await dbFetch('getRequestorInfoIdByRequestId', { request_id: req.params.id });
            if (existing.length > 0) {
                await dbUpdate('requestor_info', {
                    department: ri.department || null,
                    phone: ri.phone || null,
                    manager_name: ri.manager_name || null,
                    business_unit: ri.business_unit || null,
                    cost_center: ri.cost_center || null
                }, { request_id: req.params.id });
            } else {
                await dbInsert('requestor_info', [{
                    request_id: req.params.id,
                    department: ri.department || null,
                    phone: ri.phone || null,
                    manager_name: ri.manager_name || null,
                    business_unit: ri.business_unit || null,
                    cost_center: ri.cost_center || null
                }]);
            }
        }

        // Update or create project specs
        if (project_specs) {
            const ps = project_specs;
            const existing = await dbFetch('getProjectSpecsIdByRequestId', { request_id: req.params.id });
            if (existing.length > 0) {
                await dbUpdate('project_specs', {
                    description: ps.description || null,
                    business_justification: ps.business_justification || null,
                    expected_outcomes: ps.expected_outcomes || null,
                    technical_requirements: ps.technical_requirements || null,
                    dependencies: ps.dependencies || null,
                    risks: ps.risks || null
                }, { request_id: req.params.id });
            } else {
                await dbInsert('project_specs', [{
                    request_id: req.params.id,
                    description: ps.description || null,
                    business_justification: ps.business_justification || null,
                    expected_outcomes: ps.expected_outcomes || null,
                    technical_requirements: ps.technical_requirements || null,
                    dependencies: ps.dependencies || null,
                    risks: ps.risks || null
                }]);
            }
        }

        const fullRequest = await fetchFullRequest(req.params.id);
        res.json(fullRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
