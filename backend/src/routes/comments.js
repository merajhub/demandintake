const { Router } = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = Router();

// GET /api/comments/:requestId - Get all comments for a request
router.get('/:requestId', authenticate, async (req, res) => {
    try {
        const [comments] = await pool.query(
            `SELECT c.*, u.id AS user_id_ref, u.full_name AS user_full_name, u.role AS user_role
             FROM comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.request_id = ?
             ORDER BY c.created_at ASC`,
            [req.params.requestId]
        );

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

        const [result] = await pool.query(
            'INSERT INTO comments (request_id, user_id, message) VALUES (?, ?, ?)',
            [parseInt(req.params.requestId), req.user.id, message]
        );

        const [rows] = await pool.query(
            `SELECT c.*, u.id AS user_id_ref, u.full_name AS user_full_name, u.role AS user_role
             FROM comments c
             LEFT JOIN users u ON c.user_id = u.id
             WHERE c.id = ?`,
            [result.insertId]
        );

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
