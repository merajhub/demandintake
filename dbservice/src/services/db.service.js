/**
 * Database Service
 * ────────────────
 * Central service for all generic DB operations: fetch, insert, update.
 */
const { getPool } = require('../config/databases');
const { getQuery } = require('../config/queries');

/* ─────────────────────────── FETCH ─────────────────────────── */

/**
 * Execute a named query with optional positional parameters.
 *
 * @param {object}  opts
 * @param {string}  opts.queryName   - Registered query name (see config/queries.js)
 * @param {string}  opts.database    - Target database name
 * @param {object}  [opts.parameters]- Key/value pairs bound in declaration order
 * @returns {Promise<Array>} result rows
 */
async function fetch({ queryName, database, parameters }) {
    const sql = getQuery(queryName);
    if (!sql) {
        throw Object.assign(
            new Error(`Unknown query name: "${queryName}"`),
            { status: 400 }
        );
    }

    // Build the param array – values are applied in the order they appear
    const params = parameters ? Object.values(parameters) : [];

    const pool = getPool(database);
    const [rows] = await pool.query(sql, params);
    return rows;
}

/* ─────────────────────────── INSERT ────────────────────────── */

/**
 * Bulk-insert rows into a table.
 *
 * @param {object}   opts
 * @param {string}   opts.tablename  - Target table
 * @param {string}   opts.database   - Target database
 * @param {Array<object>} opts.data  - Array of row objects (keys = column names)
 * @returns {Promise<object>} { affectedRows, insertId }
 */
async function insert({ tablename, database, data }) {
    if (!tablename) throw Object.assign(new Error('tablename is required'), { status: 400 });
    if (!Array.isArray(data) || data.length === 0) {
        throw Object.assign(new Error('data must be a non-empty array of row objects'), { status: 400 });
    }

    // Use column names from the first row
    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const valuesSets = data.map(() => `(${placeholders})`).join(', ');

    const sql = `INSERT INTO \`${sanitizeName(tablename)}\` (\`${columns.map(sanitizeName).join('`, `')}\`) VALUES ${valuesSets}`;

    // Flatten all row values in order
    const params = data.flatMap(row => columns.map(col => row[col] ?? null));

    const pool = getPool(database);
    const [result] = await pool.query(sql, params);
    return { affectedRows: result.affectedRows, insertId: result.insertId };
}

/* ─────────────────────────── UPDATE ────────────────────────── */

/**
 * Update rows in a table.
 *
 * @param {object} opts
 * @param {string} opts.tablename  - Target table
 * @param {string} opts.database   - Target database
 * @param {object} opts.data       - Columns to SET { col: value }
 * @param {object} opts.where      - WHERE conditions (AND-ed) { col: value }
 * @returns {Promise<object>} { affectedRows, changedRows }
 */
async function update({ tablename, database, data, where }) {
    if (!tablename) throw Object.assign(new Error('tablename is required'), { status: 400 });
    if (!data || Object.keys(data).length === 0) {
        throw Object.assign(new Error('data must be a non-empty object'), { status: 400 });
    }
    if (!where || Object.keys(where).length === 0) {
        throw Object.assign(new Error('where clause is required for safety'), { status: 400 });
    }

    const setClauses = Object.keys(data).map(col => `\`${sanitizeName(col)}\` = ?`);
    const whereClauses = Object.keys(where).map(col => `\`${sanitizeName(col)}\` = ?`);

    const sql = `UPDATE \`${sanitizeName(tablename)}\` SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

    const params = [...Object.values(data), ...Object.values(where)];

    const pool = getPool(database);
    const [result] = await pool.query(sql, params);
    return { affectedRows: result.affectedRows, changedRows: result.changedRows };
}

/* ─────────────────────────── HELPERS ───────────────────────── */

/**
 * Basic identifier sanitiser – strips anything that is not
 * alphanumeric, underscore or dot to prevent SQL injection in
 * dynamic table / column names (which cannot be parameterised).
 */
function sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9_.]/g, '');
}

module.exports = { fetch, insert, update };
