/**
 * Query Registry
 * ──────────────
 * Maps a logical queryName to its SQL text.
 * Parameters are expressed as standard MySQL positional placeholders (?).
 * The caller supplies parameter values that are bound in the same order.
 *
 * Add new queries here as needed – the fetch endpoint will look them up
 * by name and reject any request whose queryName is not registered.
 */

const queries = {
    // ── Users ────────────────────────────────────────────────────────
    getAllUsers: 'SELECT * FROM users',
    getUserById: 'SELECT * FROM users WHERE id = ?',
    getUserByEmail: 'SELECT * FROM users WHERE email = ?',
    getUsersByRole: 'SELECT * FROM users WHERE role = ?',
    getUserProfileById: 'SELECT id, email, full_name, role, department, phone FROM users WHERE id = ?',

    // ── Intake Requests ──────────────────────────────────────────────
    getAllRequests:
        `SELECT ir.*, u.full_name AS requestor_name, u.email AS requestor_email
         FROM intake_requests ir
         LEFT JOIN users u ON ir.requestor_id = u.id
         ORDER BY ir.created_at DESC`,

    getRequestById:
        `SELECT ir.*, u.id AS requestor_user_id, u.full_name AS requestor_full_name,
                u.email AS requestor_email, u.department AS requestor_department
         FROM intake_requests ir
         LEFT JOIN users u ON ir.requestor_id = u.id
         WHERE ir.id = ?`,

    getRequestsByStatus:
        `SELECT ir.*, u.full_name AS requestor_name
         FROM intake_requests ir
         LEFT JOIN users u ON ir.requestor_id = u.id
         WHERE ir.status = ?
         ORDER BY ir.created_at DESC`,

    getRequestsByRequestor:
        `SELECT * FROM intake_requests WHERE requestor_id = ? ORDER BY created_at DESC`,

    getRequestsByRequestorAndStatus:
        `SELECT ir.*, u.id AS requestor_user_id, u.full_name AS requestor_full_name, u.email AS requestor_email
         FROM intake_requests ir
         LEFT JOIN users u ON ir.requestor_id = u.id
         WHERE ir.requestor_id = ? AND ir.status = ?
         ORDER BY ir.created_at DESC`,

    getRequestsByRequestorId:
        `SELECT ir.*, u.id AS requestor_user_id, u.full_name AS requestor_full_name, u.email AS requestor_email
         FROM intake_requests ir
         LEFT JOIN users u ON ir.requestor_id = u.id
         WHERE ir.requestor_id = ?
         ORDER BY ir.created_at DESC`,

    getAllRequestsWithRequestor:
        `SELECT ir.*, u.id AS requestor_user_id, u.full_name AS requestor_full_name, u.email AS requestor_email
         FROM intake_requests ir
         LEFT JOIN users u ON ir.requestor_id = u.id
         ORDER BY ir.created_at DESC`,

    getAllRequestsWithRequestorByStatus:
        `SELECT ir.*, u.id AS requestor_user_id, u.full_name AS requestor_full_name, u.email AS requestor_email
         FROM intake_requests ir
         LEFT JOIN users u ON ir.requestor_id = u.id
         WHERE ir.status = ?
         ORDER BY ir.created_at DESC`,

    getSimpleRequestById:
        'SELECT * FROM intake_requests WHERE id = ?',

    // ── Requestor Info ───────────────────────────────────────────────
    getRequestorInfoByRequestId: 'SELECT * FROM requestor_info WHERE request_id = ?',
    getRequestorInfoIdByRequestId: 'SELECT id FROM requestor_info WHERE request_id = ?',

    // ── Project Specs ────────────────────────────────────────────────
    getProjectSpecsByRequestId: 'SELECT * FROM project_specs WHERE request_id = ?',
    getProjectSpecsIdByRequestId: 'SELECT id FROM project_specs WHERE request_id = ?',

    // ── Scrub Reviews ────────────────────────────────────────────────
    getScrubReviewsByRequestId:
        `SELECT sr.*, u.id AS reviewer_user_id, u.full_name AS reviewer_full_name
         FROM scrub_reviews sr
         LEFT JOIN users u ON sr.reviewer_id = u.id
         WHERE sr.request_id = ?`,

    getAllScrubReviewsByRequestId:
        `SELECT * FROM scrub_reviews WHERE request_id = ? ORDER BY created_at ASC`,

    getScrubReviewByIdAndRequestId:
        'SELECT * FROM scrub_reviews WHERE id = ? AND request_id = ?',

    getScrubReviewById:
        'SELECT * FROM scrub_reviews WHERE id = ?',

    // ── Committee Reviews ────────────────────────────────────────────
    getCommitteeReviewsByRequestId:
        `SELECT cr.*, u.id AS reviewer_user_id, u.full_name AS reviewer_full_name
         FROM committee_reviews cr
         LEFT JOIN users u ON cr.reviewer_id = u.id
         WHERE cr.request_id = ?`,

    getAllCommitteeReviewsByRequestId:
        `SELECT * FROM committee_reviews WHERE request_id = ? ORDER BY created_at ASC`,

    // ── Comments ─────────────────────────────────────────────────────
    getCommentsByRequestId:
        `SELECT c.*, u.id AS user_id_ref, u.full_name AS user_full_name, u.role AS user_role
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.request_id = ?
         ORDER BY c.created_at ASC`,

    getCommentById:
        `SELECT c.*, u.id AS user_id_ref, u.full_name AS user_full_name, u.role AS user_role
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.id = ?`,

    getCommentsByRequestIdAndUserId:
        'SELECT * FROM comments WHERE request_id = ? AND user_id = ?',

    // ── Attachments ──────────────────────────────────────────────────
    getAttachmentsByRequestId:
        'SELECT * FROM attachments WHERE request_id = ? ORDER BY created_at DESC',

    getAttachmentById:
        'SELECT * FROM attachments WHERE id = ?',

    getRequestIdExists:
        'SELECT id FROM intake_requests WHERE id = ?',
};

/**
 * Retrieve the SQL for a registered query name.
 * @param {string} name
 * @returns {string|null}
 */
function getQuery(name) {
    return queries[name] || null;
}

/**
 * Register a new query at runtime (handy for plugins / tests).
 */
function registerQuery(name, sql) {
    queries[name] = sql;
}

/**
 * List every registered query name (useful for a discovery endpoint).
 */
function listQueryNames() {
    return Object.keys(queries);
}

module.exports = { getQuery, registerQuery, listQueryNames };
