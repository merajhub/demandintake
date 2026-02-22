/**
 * DB API Client
 * ─────────────
 * HTTP client that calls the external DB Service for all database operations.
 * Replaces direct pool.query() usage in the backend.
 */

const DB_SERVICE_URL = process.env.DB_SERVICE_URL || 'http://localhost:3001';
const DB_NAME = process.env.DB_NAME || 'demand_intake';

/**
 * Fetch rows using a named query.
 *
 * @param {string} queryName  - Registered query name in dbservice
 * @param {object} [parameters] - Key/value pairs bound in declaration order
 * @param {string} [database]   - Override database name
 * @returns {Promise<Array>} rows
 */
async function dbFetch(queryName, parameters = {}, database = DB_NAME) {
    const res = await fetch(`${DB_SERVICE_URL}/api/db/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryName, database, parameters }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        const err = new Error(json.error || 'DB fetch failed');
        err.status = res.status;
        throw err;
    }
    return json.data;
}

/**
 * Insert rows into a table.
 *
 * @param {string} tablename
 * @param {Array<object>} data - Array of row objects
 * @param {string} [database]
 * @returns {Promise<{affectedRows: number, insertId: number}>}
 */
async function dbInsert(tablename, data, database = DB_NAME) {
    const res = await fetch(`${DB_SERVICE_URL}/api/db/insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tablename, database, data }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        const err = new Error(json.error || 'DB insert failed');
        err.status = res.status;
        throw err;
    }
    return { affectedRows: json.affectedRows, insertId: json.insertId };
}

/**
 * Update rows in a table.
 *
 * @param {string} tablename
 * @param {object} data  - Columns to SET
 * @param {object} where - WHERE conditions (AND-ed)
 * @param {string} [database]
 * @returns {Promise<{affectedRows: number, changedRows: number}>}
 */
async function dbUpdate(tablename, data, where, database = DB_NAME) {
    const res = await fetch(`${DB_SERVICE_URL}/api/db/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tablename, database, data, where }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
        const err = new Error(json.error || 'DB update failed');
        err.status = res.status;
        throw err;
    }
    return { affectedRows: json.affectedRows, changedRows: json.changedRows };
}

module.exports = { dbFetch, dbInsert, dbUpdate };
