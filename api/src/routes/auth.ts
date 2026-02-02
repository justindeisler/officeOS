/**
 * Authentication routes
 * 
 * Credentials are loaded from environment variables for security.
 * See .env.example for required configuration.
 */

import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router = Router();

// Load and validate required environment variables
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is required");
}
const JWT_SECRET: string = process.env.JWT_SECRET;

// Build users from environment variables
interface UserConfig {
  passwordHash: string;
  name: string;
}

const USERS: Record<string, UserConfig> = {};

// Load Justin's credentials
if (process.env.AUTH_JUSTIN_HASH) {
  USERS.justin = {
    passwordHash: process.env.AUTH_JUSTIN_HASH,
    name: process.env.AUTH_JUSTIN_NAME || "Justin",
  };
}

// Load James's credentials
if (process.env.AUTH_JAMES_HASH) {
  USERS.james = {
    passwordHash: process.env.AUTH_JAMES_HASH,
    name: process.env.AUTH_JAMES_NAME || "James",
  };
}

// Warn if no users configured
if (Object.keys(USERS).length === 0) {
  console.warn("[Auth] WARNING: No users configured. Set AUTH_*_HASH environment variables.");
}

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
