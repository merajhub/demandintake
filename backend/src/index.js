const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const requestRoutes = require('./routes/requests');
const workflowRoutes = require('./routes/workflow');
const attachmentRoutes = require('./routes/attachments');
const commentRoutes = require('./routes/comments');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/comments', commentRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

// Start server
async function start() {
    try {
        // Verify DB Service is reachable
        const dbServiceUrl = process.env.DB_SERVICE_URL || 'http://localhost:3001';
        const healthRes = await fetch(`${dbServiceUrl}/api/health`);
        const health = await healthRes.json();
        console.log('DB Service connected:', health);

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.warn('Warning: DB Service not reachable. Starting anyway...', error.message);
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    }
}

start();
