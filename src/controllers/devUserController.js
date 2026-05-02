import bcrypt from "bcryptjs";
import { UserModel } from "../models/userModel.js";

// same regex you used in auth controller (kept here to avoid weak passwords)
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isStrongPassword = (password) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/.test(
    password
  );

/**
 * DEV ONLY: Create or promote an admin user.
 * POST /api/dev/users/seed-admin
 * body: { name, email, password }
 */
export const seedAdmin = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Dev route disabled in production" });
    }

    const { name = "System Admin", email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be 8+ chars with uppercase, lowercase, number, and special character.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await UserModel.getUserByEmail(normalizedEmail);
    const hashed = bcrypt.hashSync(password, 10);

    // If user exists -> promote to admin and reset password (dev convenience)
    if (existing) {
      const updated = await UserModel.updateUser(existing.id, {
        role: "admin",
        password: hashed,
        name: name || existing.name,
        updatedAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "User promoted to admin (password updated)",
        user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
      });
    }

    // Create new admin user
    const created = await UserModel.createUser({
      name,
      email: normalizedEmail,
      password: hashed,
      role: "admin",
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: "Admin user created",
      user: { id: created.id, name: created.name, email: created.email, role: created.role },
    });
  } catch (err) {
    console.error("seedAdmin error:", err);
    return res.status(500).json({ error: "Failed to seed admin user" });
  }
};
