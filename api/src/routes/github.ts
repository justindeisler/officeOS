/**
 * GitHub API routes - fetch repos from GitHub CLI
 */

import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { createLogger } from "../logger.js";

const router = Router();
const log = createLogger("github");
const execFileAsync = promisify(execFile);

const GH_USERNAME = process.env.GH_USERNAME || "justindeisler";

interface GitHubRepo {
  name: string;
  description: string | null;
  url: string;
  updatedAt: string;
}

/**
 * GET /api/github/repos
 * List GitHub repositories using the gh CLI.
 * Returns repos updated in the last 6 months, sorted by most recent.
 */
router.get("/repos", async (_req, res) => {
  try {
    // Check if gh CLI is available and authenticated
    const { stdout } = await execFileAsync("gh", [
      "repo", "list", GH_USERNAME,
      "--json", "name,description,url,updatedAt",
      "--limit", "50",
      "--no-archived",
    ], {
      timeout: 15000,
      env: {
        ...process.env,
        HOME: "/home/jd-server-admin",
        PATH: process.env.PATH,
      },
    });

    let repos: GitHubRepo[] = [];
    try {
      repos = JSON.parse(stdout);
    } catch {
      log.warn("Failed to parse gh repo list output");
      return res.json({ repos: [], message: "Failed to parse GitHub response" });
    }

    // Filter to repos updated in last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const activeRepos = repos
      .filter((r: GitHubRepo) => new Date(r.updatedAt) > sixMonthsAgo)
      .sort((a: GitHubRepo, b: GitHubRepo) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .map((r: GitHubRepo) => ({
        name: r.name,
        description: r.description || "",
        url: r.url,
        updatedAt: r.updatedAt,
      }));

    log.info({ count: activeRepos.length }, "Fetched GitHub repos");
    res.json({ repos: activeRepos });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);

    if (errMsg.includes("not logged in") || errMsg.includes("auth login")) {
      log.warn("GitHub CLI not authenticated");
      return res.json({
        repos: [],
        message: "GitHub CLI not authenticated. Run `gh auth login` to enable.",
        authenticated: false,
      });
    }

    log.error({ err: error }, "Failed to fetch GitHub repos");
    res.json({
      repos: [],
      message: `Failed to fetch repos: ${errMsg}`,
    });
  }
});

export default router;
