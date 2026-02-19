/**
 * Startup secrets validation — fail fast if secrets are missing or placeholder.
 *
 * Called at the very top of index.ts before Express app setup.
 * Validates that all required environment variables are present, non-empty,
 * and not set to placeholder/weak values.
 *
 * Never logs actual secret values — only presence/format information.
 */

import { logger } from "./logger.js";

/** Known placeholder / dummy values that should never be used in production */
const PLACEHOLDER_PATTERNS = [
  "your-secret-key",
  "your-secret-here",
  "changeme",
  "change-me",
  "change_me",
  "change-in-production",
  "xxx",
  "placeholder",
  "example",
  "replace-me",
  "test-secret",
  "default",
  "secret",
  "password",
  "todo",
  "fixme",
];

interface ValidationRule {
  name: string;
  required: boolean;
  minLength?: number;
  pattern?: RegExp;
  patternDescription?: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    name: "JWT_SECRET",
    required: true,
    minLength: 32,
    pattern: /^[A-Za-z0-9+/=_\-]+$/,
    patternDescription: "alphanumeric/base64 string, minimum 32 characters",
  },
  {
    name: "PORT",
    required: false, // has a default in code
    pattern: /^\d+$/,
    patternDescription: "numeric port number",
  },
  {
    name: "JWT_PRIVATE_KEY",
    required: true,
    minLength: 100, // base64-encoded RSA key is long
    patternDescription: "base64-encoded RSA private key",
  },
  {
    name: "JWT_PUBLIC_KEY",
    required: true,
    minLength: 100,
    patternDescription: "base64-encoded RSA public key",
  },
  {
    name: "REFRESH_TOKEN_SECRET",
    required: true,
    minLength: 32,
    pattern: /^[A-Fa-f0-9]+$/,
    patternDescription: "hex-encoded secret, minimum 32 characters",
  },
  {
    name: "AZURE_API_KEY",
    required: false,
    minLength: 16,
  },
  {
    name: "AZURE_ENDPOINT",
    required: false,
    pattern: /^https:\/\/.+/,
    patternDescription: "HTTPS URL",
  },
];

function isPlaceholder(value: string): boolean {
  const lower = value.trim().toLowerCase();
  return PLACEHOLDER_PATTERNS.some(
    (p) => lower === p || lower.startsWith(p)
  );
}

export function validateStartupSecrets(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.info("Running startup secrets validation...");

  for (const rule of VALIDATION_RULES) {
    const value = process.env[rule.name];

    // Check presence
    if (!value || value.trim() === "") {
      if (rule.required) {
        errors.push(`${rule.name}: MISSING — this variable is required`);
      }
      continue; // skip further checks for absent optional vars
    }

    // Check for placeholder values
    if (isPlaceholder(value)) {
      if (rule.required) {
        errors.push(
          `${rule.name}: appears to be a placeholder/default value — use a real secret`
        );
      } else {
        warnings.push(
          `${rule.name}: appears to be a placeholder/default value`
        );
      }
      continue;
    }

    // Check minimum length
    if (rule.minLength && value.length < rule.minLength) {
      const msg = `${rule.name}: too short (${value.length} chars, need >= ${rule.minLength})`;
      if (rule.required) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
      continue;
    }

    // Check format pattern
    if (rule.pattern && !rule.pattern.test(value)) {
      const msg = `${rule.name}: invalid format — expected ${rule.patternDescription || "valid pattern"}`;
      if (rule.required) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
      continue;
    }

    logger.info(`  ✓ ${rule.name}: present, valid format`);
  }

  // Log warnings
  for (const warning of warnings) {
    logger.warn(`  ⚠ ${warning}`);
  }

  // Fail on errors
  if (errors.length > 0) {
    const separator = "=".repeat(60);
    const errorReport = errors.map((e) => `  ✗ ${e}`).join("\n");
    const msg = [
      "",
      separator,
      `STARTUP SECRETS VALIDATION FAILED (${errors.length} error(s)):`,
      errorReport,
      separator,
      "Fix the above issues and restart.",
      "See .env.example for required variables and formats.",
      `Generate a JWT secret with: openssl rand -base64 32`,
    ].join("\n");

    logger.fatal(msg);
    process.exit(1);
  }

  logger.info("Startup secrets validation passed — all checks OK");
}
