/**
 * Role-based access control middleware.
 * Usage: requireRole(["admin"])
 * Assumes verifyToken already set req.user = { id, role, ... }
 */
export const requireRole = (roles = []) => {
  return (req, res, next) => {
    const role = req.user?.role;

    if (!role) {
      return res.status(403).json({ error: "Role missing in token" });
    }

    if (!roles.includes(role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }

    next();
  };
};
