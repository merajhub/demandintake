/**
 * Multi-database connection pool manager.
 * Creates and caches a mysql2 pool per database name so that
 * endpoints can target any database at runtime.
 */
const mysql = require('mysql2/promise');

const pools = {};

/**
 * Returns (or lazily creates) a connection pool for the given database.
 * Connection params come from env vars; only the `database` field changes.
 */
function getPool(database) {
    if (!database) {
        throw new Error('Database name is required');
    }

    if (!pools[database]) {
        pools[database] = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '1qaz!QAZ',
            database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
    }

    return pools[database];
}

/**
 * Gracefully close every pool (call on shutdown).
 */
async function closeAll() {
    for (const [name, pool] of Object.entries(pools)) {
        await pool.end();
        delete pools[name];
    }
}

module.exports = { getPool, closeAll };
