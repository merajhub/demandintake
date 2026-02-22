const { Router } = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// PUT /api/workflow/:id/submit - Requestor submits the intake form
router.put('/:id/submit', authenticate, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM intake_requests WHERE id = ?', [req.params.id]);
        if (rows.length === 0) { res.status(404).json({ error: 'Request not found' }); return; }
        const request = rows[0];

        if (request.requestor_id !== req.user.id) {
            res.status(403).json({ error: 'Only the requestor can submit' }); return;
        }

        if (!['draft', 'scrub_questions', 'committee_questions'].includes(request.status)) {
            res.status(400).json({ error: `Cannot submit from status: ${request.status}` }); return;
        }

        let newStatus = 'submitted';
        if (request.status === 'scrub_questions') {
            newStatus = 'scrub_review';
        } else if (request.status === 'committee_questions') {
            newStatus = 'committee_review';
        }

        await pool.query(
            'UPDATE intake_requests SET status = ?, date_of_submission = NOW() WHERE id = ?',
            [newStatus, req.params.id]
        );
        res.json({ message: 'Request submitted successfully', status: newStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/workflow/:id/scrub-review - Scrub team reviews the request
router.put('/:id/scrub-review', authenticate, authorize('scrub_team', 'admin'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM intake_requests WHERE id = ?', [req.params.id]);
        if (rows.length === 0) { res.status(404).json({ error: 'Request not found' }); return; }
        const request = rows[0];

        if (!['submitted', 'scrub_review', 'scrub_questions'].includes(request.status)) {
            res.status(400).json({ error: `Cannot review from status: ${request.status}` }); return;
        }

        const { decision, remarks } = req.body;
        if (!decision || !['approve', 'reject', 'need_info'].includes(decision)) {
            res.status(400).json({ error: 'Valid decision (approve/reject/need_info) is required' }); return;
        }

        // Create the review record
        await pool.query(
            'INSERT INTO scrub_reviews (request_id, reviewer_id, decision, remarks) VALUES (?, ?, ?, ?)',
            [request.id, req.user.id, decision, remarks || null]
        );

        // Determine new status
        let newStatus;
        if (decision === 'reject') {
            newStatus = 'rejected';
        } else if (decision === 'need_info') {
            newStatus = 'scrub_questions';
        } else if (decision === 'approve') {
            // Check if ALL participating scrub members have approved
            const [allReviews] = await pool.query(
                'SELECT * FROM scrub_reviews WHERE request_id = ? ORDER BY created_at ASC',
                [request.id]
            );
            const latestByReviewer = {};
            for (const r of allReviews) {
                const ts = new Date(r.created_at).getTime();
                if (!latestByReviewer[r.reviewer_id] || ts > latestByReviewer[r.reviewer_id].ts) {
                    latestByReviewer[r.reviewer_id] = { decision: r.decision, ts };
                }
            }
            const allApproved = Object.values(latestByReviewer).every(r => r.decision === 'approve');
            if (allApproved) {
                newStatus = 'committee_review';
            } else if (request.status === 'scrub_questions') {
                newStatus = 'scrub_questions';
            } else {
                newStatus = 'scrub_review';
            }
        } else {
            newStatus = request.status;
        }

        await pool.query('UPDATE intake_requests SET status = ? WHERE id = ?', [newStatus, request.id]);
        res.json({ message: `Scrub review completed: ${decision}`, status: newStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/workflow/:id/scrub-review/:reviewId - Edit an existing scrub review question
router.put('/:id/scrub-review/:reviewId', authenticate, authorize('scrub_team', 'admin'), async (req, res) => {
    try {
        const [reviews] = await pool.query(
            'SELECT * FROM scrub_reviews WHERE id = ? AND request_id = ?',
            [req.params.reviewId, req.params.id]
        );
        if (reviews.length === 0) { res.status(404).json({ error: 'Review not found' }); return; }
        const review = reviews[0];

        // Only the original reviewer can edit
        if (review.reviewer_id !== req.user.id) {
            res.status(403).json({ error: 'Only the original reviewer can edit this review' }); return;
        }

        // Only need_info reviews can be edited
        if (review.decision !== 'need_info') {
            res.status(400).json({ error: 'Only need_info reviews can be edited' }); return;
        }

        // Check if the submitter has already replied after this review
        const [requestRows] = await pool.query('SELECT * FROM intake_requests WHERE id = ?', [req.params.id]);
        if (requestRows.length === 0) { res.status(404).json({ error: 'Request not found' }); return; }
        const request = requestRows[0];

        const [submitterReplies] = await pool.query(
            'SELECT * FROM comments WHERE request_id = ? AND user_id = ?',
            [req.params.id, request.requestor_id]
        );
        const reviewTime = new Date(review.created_at).getTime();
        const hasReplyAfter = submitterReplies.some(
            c => new Date(c.created_at).getTime() > reviewTime
        );
        if (hasReplyAfter) {
            res.status(400).json({ error: 'Cannot edit after the submitter has replied' }); return;
        }

        const { remarks } = req.body;
        await pool.query('UPDATE scrub_reviews SET remarks = ? WHERE id = ?', [remarks, review.id]);

        // Return updated review
        const [updated] = await pool.query('SELECT * FROM scrub_reviews WHERE id = ?', [review.id]);
        res.json({ message: 'Review updated successfully', review: updated[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/workflow/:id/committee-review - Committee reviews the request
router.put('/:id/committee-review', authenticate, authorize('committee', 'admin'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM intake_requests WHERE id = ?', [req.params.id]);
        if (rows.length === 0) { res.status(404).json({ error: 'Request not found' }); return; }
        const request = rows[0];

        if (!['committee_review', 'committee_questions'].includes(request.status)) {
            res.status(400).json({ error: `Cannot committee-review from status: ${request.status}` }); return;
        }

        const { decision, remarks } = req.body;
        if (!decision || !['approve', 'reject', 'need_info'].includes(decision)) {
            res.status(400).json({ error: 'Valid decision (approve/reject/need_info) is required' }); return;
        }

        // Create the review record
        await pool.query(
            'INSERT INTO committee_reviews (request_id, reviewer_id, decision, remarks) VALUES (?, ?, ?, ?)',
            [request.id, req.user.id, decision, remarks || null]
        );

        // Determine new status
        let newStatus;
        if (decision === 'reject') {
            newStatus = 'rejected';
        } else if (decision === 'need_info') {
            newStatus = 'committee_questions';
        } else if (decision === 'approve') {
            const [allReviews] = await pool.query(
                'SELECT * FROM committee_reviews WHERE request_id = ? ORDER BY created_at ASC',
                [request.id]
            );
            const latestByReviewer = {};
            for (const r of allReviews) {
                const ts = new Date(r.created_at).getTime();
                if (!latestByReviewer[r.reviewer_id] || ts > latestByReviewer[r.reviewer_id].ts) {
                    latestByReviewer[r.reviewer_id] = { decision: r.decision, ts };
                }
            }
            const allApproved = Object.values(latestByReviewer).every(r => r.decision === 'approve');
            if (allApproved) {
                newStatus = 'approved';
            } else if (request.status === 'committee_questions') {
                newStatus = 'committee_questions';
            } else {
                newStatus = 'committee_review';
            }
        } else {
            newStatus = request.status;
        }

        await pool.query('UPDATE intake_requests SET status = ? WHERE id = ?', [newStatus, request.id]);
        res.json({ message: `Committee review completed: ${decision}`, status: newStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/workflow/:id/start-development - Move approved request to development
router.put('/:id/start-development', authenticate, authorize('admin', 'committee'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM intake_requests WHERE id = ?', [req.params.id]);
        if (rows.length === 0) { res.status(404).json({ error: 'Request not found' }); return; }
        const request = rows[0];

        if (request.status !== 'approved') {
            res.status(400).json({ error: 'Only approved requests can start development' }); return;
        }

        await pool.query('UPDATE intake_requests SET status = ? WHERE id = ?', ['development', request.id]);
        res.json({ message: 'Development started', status: 'development' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
