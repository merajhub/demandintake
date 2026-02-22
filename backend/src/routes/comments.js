const { Router } = require('express');
const { dbFetch, dbInsert } = require('../services/dbClient');
const { authenticate } = require('../middleware/auth');

const router = Router();

// GET /api/comments/:requestId - Get all comments for a request
router.get('/:requestId', authenticate, async (req, res) => {
    try {
        const comments = await dbFetch('getCommentsByRequestId', { request_id: req.params.requestId });

        const result = comments.map(c => ({
            ...c,
            user: { id: c.user_id_ref, full_name: c.user_full_name, role: c.user_role },
            user_id_ref: undefined,
            user_full_name: undefined,
            user_role: undefined
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/comments/:requestId - Add a comment to a request
router.post('/:requestId', authenticate, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            res.status(400).json({ error: 'Message is required' }); return;
        }

        const result = await dbInsert('comments', [{
            request_id: parseInt(req.params.requestId),
            user_id: req.user.id,
            message
        }]);

        const rows = await dbFetch('getCommentById', { id: result.insertId });

        const comment = rows[0];
        const fullComment = {
            ...comment,
            user: { id: comment.user_id_ref, full_name: comment.user_full_name, role: comment.user_role },
            user_id_ref: undefined,
            user_full_name: undefined,
            user_role: undefined
        };

        res.status(201).json(fullComment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
