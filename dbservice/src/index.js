const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const dbRoutes = require('./routes/db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/db', dbRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'db-service', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, _req, res, _next) => {
    console.error('DB Service Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

app.listen(PORT, () => {
    console.log(`DB Service running on http://localhost:${PORT}`);
});
