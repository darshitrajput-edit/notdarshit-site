const jwt = require('jsonwebtoken');

/**
 * Protects admin-only routes. Expects:
 *   Authorization: Bearer <token>
 * A valid token is issued by POST /api/auth/login.
 */
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Login required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session expired. Please log in again.' });
  }
}

module.exports = { requireAdmin };
