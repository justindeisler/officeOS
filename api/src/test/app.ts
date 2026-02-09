/**
 * Test Express App Builder
 *
 * Creates a minimal Express app with the same middleware as production
 * but using the test database. No auth required by default.
 */

import express from 'express';

/**
 * Create a test Express app with JSON parsing and the given router
 */
export function createTestApp(router: express.Router, prefix = '/api') {
  const app = express();

  // Same middleware as production
  app.use(express.json());

  // Mount the router
  app.use(prefix, router);

  // Simple error handler for tests
  app.use(
    (
      err: { statusCode?: number; status?: number; message?: string; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status = err.statusCode ?? err.status ?? 500;
      res.status(status).json({
        error: {
          code: err.code ?? 'INTERNAL_ERROR',
          message: err.message ?? 'Internal Server Error',
        },
      });
    }
  );

  return app;
}
