const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, full_name, role, department, phone } = req.body;

        if (!email || !password || !full_name) {
            res.status(400).json({ error: 'Email, password, and full_name are required' });
            return;
        }

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            res.status(409).json({ error: 'Email already registered' });
            return;
        }

        const password_hash = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (email, password_hash, full_name, role, department, phone) VALUES (?, ?, ?, ?, ?, ?)',
            [email, password_hash, full_name, role || 'requestor', department || null, phone || null]
        );

        const userId = result.insertId;
        const secret = process.env.JWT_SECRET || 'default-secret';
        const token = jwt.sign(
            { id: userId, email, role: role || 'requestor', full_name },
            secret,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            token,
            user: { id: userId, email, full_name, role: role || 'requestor' }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(email, password);
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const user = rows[0];
        console.log(user.password_hash);
        const validPassword = password === user.password_hash;
        if (!validPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const secret = process.env.JWT_SECRET || 'default-secret';
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
            secret,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, email, full_name, role, department, phone FROM users WHERE id = ?',
            [req.user.id]
        );
        if (rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
