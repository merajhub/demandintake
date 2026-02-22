const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbFetch, dbInsert } = require('../services/dbClient');
const { authenticate } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.txt', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed'));
        }
    }
});

const router = Router();

// POST /api/attachments/:requestId - Upload file(s) for a request
router.post('/:requestId', authenticate, upload.array('files', 5), async (req, res) => {
    try {
        const requestRows = await dbFetch('getRequestIdExists', { id: req.params.requestId });
        if (requestRows.length === 0) { res.status(404).json({ error: 'Request not found' }); return; }

        const files = req.files;
        if (!files || files.length === 0) {
            res.status(400).json({ error: 'No files uploaded' }); return;
        }

        const attachments = [];
        for (const file of files) {
            const result = await dbInsert('attachments', [{
                request_id: req.params.requestId,
                uploaded_by: req.user.id,
                original_name: file.originalname,
                filename: file.filename,
                filepath: file.path,
                mimetype: file.mimetype,
                size: file.size
            }]);
            const rows = await dbFetch('getAttachmentById', { id: result.insertId });
            attachments.push(rows[0]);
        }

        res.status(201).json(attachments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/attachments/:requestId - List attachments for a request
router.get('/:requestId', authenticate, async (req, res) => {
    try {
        const attachments = await dbFetch('getAttachmentsByRequestId', { request_id: req.params.requestId });
        res.json(attachments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/attachments/download/:id - Download a specific attachment
router.get('/download/:id', authenticate, async (req, res) => {
    try {
        const rows = await dbFetch('getAttachmentById', { id: req.params.id });
        if (rows.length === 0) { res.status(404).json({ error: 'Attachment not found' }); return; }

        const attachment = rows[0];
        res.download(attachment.filepath, attachment.original_name);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
