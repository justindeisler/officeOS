/**
 * JWT Authentication Middleware — RS256
 *
 * Validates Bearer tokens from the Authorization header.
 * Returns uniform 401 responses — never leaks why auth failed.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createLogger } from "../logger.js";

const log = createLogger("auth-middleware");

// Decode RSA public key from base64 env var (set at module load)
const JWT_PUBLIC_KEY: string | null = process.env.JWT_PUBLIC_KEY
  ? Buffer.from(process.env.JWT_PUBLIC_KEY, "base64").toString("utf-8")
  : null;

// Expected claims
const EXPECTED_ISSUER = "james-pa-api";
const EXPECTED_AUDIENCE = "james-pa-client";

export interface AuthUser {
  userId: string;
  role: string;
  permissions: string[];
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Auth middleware — verifies RS256 JWT, validates iss/aud, attaches req.user.
 * All failures return exactly { "error": "Unauthorized" } with 401.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  // 1. Check for public key availability
  if (!JWT_PUBLIC_KEY) {
    log.error("JWT_PUBLIC_KEY not configured — rejecting all requests");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 2. Extract Bearer token from Authorization header only
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    log.warn({ ip, reason: "missing_or_malformed_authorization_header", timestamp: new Date().toISOString() });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7); // "Bearer ".length === 7

  if (!token || token.trim() === "") {
    log.warn({ ip, reason: "empty_token", timestamp: new Date().toISOString() });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 3. Verify token — RS256, check exp + iss + aud
  try {
    const decoded = jwt.verify(token, JWT_PUBLIC_KEY, {
      algorithms: ["RS256"],
      issuer: EXPECTED_ISSUER,
      audience: EXPECTED_AUDIENCE,
      clockTolerance: 5, // 5s tolerance for clock skew
    }) as jwt.JwtPayload;

    // 4. Extract user fields
    const userId = decoded.userId;
    const role = decoded.role || "user";
    const permissions = Array.isArray(decoded.permissions)
      ? decoded.permissions
      : [];

    if (!userId) {
      log.warn({ ip, reason: "token_missing_userId", timestamp: new Date().toISOString() });
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 5. Attach to request
    req.user = { userId, role, permissions };
    next();
  } catch (err) {
    // Determine reason for logging — NEVER log the token itself
    let reason = "token_verification_failed";
    if (err instanceof jwt.TokenExpiredError) {
      reason = "token_expired";
    } else if (err instanceof jwt.JsonWebTokenError) {
      reason = "invalid_token_signature_or_claims";
    } else if (err instanceof jwt.NotBeforeError) {
      reason = "token_not_yet_valid";
    }

    log.warn({ ip, reason, timestamp: new Date().toISOString() });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
}

export default authMiddleware;
