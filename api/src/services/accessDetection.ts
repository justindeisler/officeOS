/**
 * Access Detection Service
 *
 * Determines whether James can implement a suggestion directly by checking:
 * 1. Local filesystem access (project has a codebase_path)
 * 2. GitHub push access (via gh CLI's viewerPermission)
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { homedir } from "os";
import { createLogger } from "../logger.js";

const execFileAsync = promisify(execFile);
const log = createLogger("access-detection");

export interface AccessResult {
  hasAccess: boolean;
  accessType: "local" | "github" | "none";
}

/**
 * Resolve ~ to actual home directory
 */
function resolvePath(p: string): string {
  if (p.startsWith("~/")) {
    return p.replace("~", homedir());
  }
  return p;
}

/**
 * Check if James has local filesystem access to a project
 */
function checkLocalAccess(codebasePath: string | null): boolean {
  if (!codebasePath) return false;

  const resolved = resolvePath(codebasePath);
  return existsSync(resolved);
}

/**
 * Check if James has GitHub push access to a repo
 */
async function checkGitHubAccess(githubRepo: string | null): Promise<boolean> {
  if (!githubRepo) return false;

  try {
    const { stdout } = await execFileAsync("gh", [
      "repo", "view", githubRepo,
      "--json", "viewerPermission",
    ], {
      timeout: 10000,
      env: {
        ...process.env,
        HOME: homedir(),
        PATH: process.env.PATH,
      },
    });

    const result = JSON.parse(stdout);
    const permission = result.viewerPermission;

    log.info({ githubRepo, permission }, "GitHub permission check");

    return permission === "WRITE" || permission === "ADMIN";
  } catch (error) {
    log.warn({ err: error, githubRepo }, "GitHub access check failed");
    return false;
  }
}

/**
 * Detect if James has implementation access for a project
 *
 * Priority: local access > GitHub access > no access
 */
export async function detectAccess(
  codebasePath: string | null,
  githubRepo: string | null
): Promise<AccessResult> {
  // Check local access first (preferred)
  if (checkLocalAccess(codebasePath)) {
    return { hasAccess: true, accessType: "local" };
  }

  // Check GitHub access
  if (await checkGitHubAccess(githubRepo)) {
    return { hasAccess: true, accessType: "github" };
  }

  return { hasAccess: false, accessType: "none" };
}
