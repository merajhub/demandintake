const { Router } = require('express');
const { dbFetch, dbInsert, dbUpdate } = require('../services/dbClient');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

// PUT /api/workflow/:id/submit - Requestor submits the intake form
router.put('/:id/submit', authenticate, async (req, res) => {
    try {
        const rows = await dbFetch('getSimpleRequestById', { id: req.params.id });
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

        await dbUpdate('intake_requests', {
            status: newStatus,
            date_of_submission: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }, { id: req.params.id });

        res.json({ message: 'Request submitted successfully', status: newStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/workflow/:id/scrub-review - Scrub team reviews the request
router.put('/:id/scrub-review', authenticate, authorize('scrub_team', 'admin'), async (req, res) => {
    try {
        const rows = await dbFetch('getSimpleRequestById', { id: req.params.id });
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
        await dbInsert('scrub_reviews', [{
            request_id: request.id,
            reviewer_id: req.user.id,
            decision,
            remarks: remarks || null
        }]);

        // Determine new status
        let newStatus;
        if (decision === 'reject') {
            newStatus = 'rejected';
        } else if (decision === 'need_info') {
            newStatus = 'scrub_questions';
        } else if (decision === 'approve') {
            // Check if ALL participating scrub members have approved
            const allReviews = await dbFetch('getAllScrubReviewsByRequestId', { request_id: request.id });
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

        await dbUpdate('intake_requests', { status: newStatus }, { id: request.id });
        res.json({ message: `Scrub review completed: ${decision}`, status: newStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/workflow/:id/scrub-review/:reviewId - Edit an existing scrub review question
router.put('/:id/scrub-review/:reviewId', authenticate, authorize('scrub_team', 'admin'), async (req, res) => {
    try {
        const reviews = await dbFetch('getScrubReviewByIdAndRequestId', {
            reviewId: req.params.reviewId,
            requestId: req.params.id
        });
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
        const requestRows = await dbFetch('getSimpleRequestById', { id: req.params.id });
        if (requestRows.length === 0) { res.status(404).json({ error: 'Request not found' }); return; }
        const request = requestRows[0];

        const submitterReplies = await dbFetch('getCommentsByRequestIdAndUserId', {
            request_id: req.params.id,
            user_id: request.requestor_id
        });
        const reviewTime = new Date(review.created_at).getTime();
        const hasReplyAfter = submitterReplies.some(
            c => new Date(c.created_at).getTime() > reviewTime
        );
        if (hasReplyAfter) {
            res.status(400).json({ error: 'Cannot edit after the submitter has replied' }); return;
        }

        const { remarks } = req.body;
        await dbUpdate('scrub_reviews', { remarks }, { id: review.id });

        // Return updated review
        const updated = await dbFetch('getScrubReviewById', { id: review.id });
        res.json({ message: 'Review updated successfully', review: updated[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/workflow/:id/committee-review - Committee reviews the request
router.put('/:id/committee-review', authenticate, authorize('committee', 'admin'), async (req, res) => {
    try {
        const rows = await dbFetch('getSimpleRequestById', { id: req.params.id });
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
        await dbInsert('committee_reviews', [{
            request_id: request.id,
            reviewer_id: req.user.id,
            decision,
            remarks: remarks || null
        }]);

        // Determine new status
        let newStatus;
        if (decision === 'reject') {
            newStatus = 'rejected';
        } else if (decision === 'need_info') {
            newStatus = 'committee_questions';
        } else if (decision === 'approve') {
            const allReviews = await dbFetch('getAllCommitteeReviewsByRequestId', { request_id: request.id });
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

        await dbUpdate('intake_requests', { status: newStatus }, { id: request.id });
        res.json({ message: `Committee review completed: ${decision}`, status: newStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/workflow/:id/start-development - Move approved request to development
router.put('/:id/start-development', authenticate, authorize('admin', 'committee'), async (req, res) => {
    try {
        const rows = await dbFetch('getSimpleRequestById', { id: req.params.id });
        if (rows.length === 0) { res.status(404).json({ error: 'Request not found' }); return; }
        const request = rows[0];

        if (request.status !== 'approved') {
            res.status(400).json({ error: 'Only approved requests can start development' }); return;
        }

        await dbUpdate('intake_requests', { status: 'development' }, { id: request.id });
        res.json({ message: 'Development started', status: 'development' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
