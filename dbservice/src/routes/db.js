/**
 * DB Routes
 * ─────────
 * POST /api/db/fetch   – Execute a named query
 * POST /api/db/insert  – Insert rows into a table
 * POST /api/db/update  – Update rows in a table
 * GET  /api/db/queries – List all registered query names
 */
const { Router } = require('express');
const dbService = require('../services/db.service');
const { listQueryNames } = require('../config/queries');

const router = Router();

// ─── FETCH ───────────────────────────────────────────────────────
router.post('/fetch', async (req, res) => {
    try {
        const { queryName, database, parameters } = req.body;

        if (!queryName) {
            return res.status(400).json({ error: 'queryName is required' });
        }
        if (!database) {
            return res.status(400).json({ error: 'database is required' });
        }

        const rows = await dbService.fetch({ queryName, database, parameters });
        res.json({ success: true, data: rows });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ success: false, error: error.message });
    }
});

// ─── INSERT ──────────────────────────────────────────────────────
router.post('/insert', async (req, res) => {
    try {
        const { tablename, database, data } = req.body;

        if (!tablename) {
            return res.status(400).json({ error: 'tablename is required' });
        }
        if (!database) {
            return res.status(400).json({ error: 'database is required' });
        }
        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: 'data must be a non-empty array of row objects' });
        }

        const result = await dbService.insert({ tablename, database, data });
        res.status(201).json({ success: true, ...result });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ success: false, error: error.message });
    }
});

// ─── UPDATE ──────────────────────────────────────────────────────
router.post('/update', async (req, res) => {
    try {
        const { tablename, database, data, where } = req.body;

        if (!tablename) {
            return res.status(400).json({ error: 'tablename is required' });
        }
        if (!database) {
            return res.status(400).json({ error: 'database is required' });
        }
        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'data must be a non-empty object' });
        }
        if (!where || Object.keys(where).length === 0) {
            return res.status(400).json({ error: 'where clause is required' });
        }

        const result = await dbService.update({ tablename, database, data, where });
        res.json({ success: true, ...result });
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ success: false, error: error.message });
    }
});

// ─── LIST QUERIES ────────────────────────────────────────────────
router.get('/queries', (_req, res) => {
    res.json({ success: true, queries: listQueryNames() });
});

module.exports = router;
