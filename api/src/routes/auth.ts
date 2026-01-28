/**
 * Authentication routes
 */

import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = Router();

// Secret key for JWT - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || "pa-secret-key-change-in-production-2026";

// User credentials - in production, store hashed in database
const USERS: Record<string, { passwordHash: string; name: string }> = {
  justin: {
    passwordHash: bcrypt.hashSync("Kobold11!", 10),
    name: "Justin Deisler",
  },
  james: {
    passwordHash: bcrypt.hashSync("J4m3s-PA-2026!", 10),
    name: "James (AI Assistant)",
  },
};

// Login
router.post("/login", async (req, res) => {
  const { username, password, rememberMe } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const user = USERS[username.toLowerCase()];
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Token expiration: 7 days normally, 1 year if "remember me"
  const expiresIn = rememberMe ? "365d" : "7d";

  const token = jwt.sign(
    { username: username.toLowerCase(), name: user.name },
    JWT_SECRET,
    { expiresIn }
  );

  res.json({
    token,
    user: {
      username: username.toLowerCase(),
      name: user.name,
    },
    expiresIn,
  });
});

// Verify token
router.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string; name: string };
    res.json({
      valid: true,
      user: {
        username: decoded.username,
        name: decoded.name,
      },
    });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Middleware to protect routes
export function authMiddleware(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as unknown as Record<string, unknown>).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export default router;
