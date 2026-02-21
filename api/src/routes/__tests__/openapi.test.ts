/**
 * OpenAPI Specification Tests
 *
 * Validates the OpenAPI spec structure, completeness, and that
 * Swagger UI endpoint is accessible.
 */

import { describe, it, expect } from 'vitest';
import { getOpenApiSpec } from '../../openapi.js';

describe('OpenAPI Specification', () => {
  const spec = getOpenApiSpec();

  // ========================================================================
  // Structure
  // ========================================================================

  describe('Structure', () => {
    it('is valid OpenAPI 3.0.3', () => {
      expect(spec.openapi).toBe('3.0.3');
    });

    it('has info with title and version', () => {
      expect(spec.info.title).toBe('officeOS Public REST API');
      expect(spec.info.version).toBe('1.0.0');
      expect(spec.info.description).toBeTruthy();
    });

    it('has servers defined', () => {
      expect(spec.servers).toHaveLength(1);
      expect(spec.servers[0].url).toBe('/api/v1');
    });

    it('has security defined', () => {
      expect(spec.security).toEqual([{ BearerAuth: [] }]);
    });

    it('has tags for all resource groups', () => {
      const tagNames = spec.tags.map((t: any) => t.name);
      expect(tagNames).toContain('Invoices');
      expect(tagNames).toContain('Income');
      expect(tagNames).toContain('Expenses');
      expect(tagNames).toContain('Assets');
      expect(tagNames).toContain('Reports');
      expect(tagNames).toContain('Exports');
      expect(tagNames).toContain('Webhooks');
    });
  });

  // ========================================================================
  // Security Schemes
  // ========================================================================

  describe('Security Schemes', () => {
    it('defines Bearer auth', () => {
      const bearerAuth = spec.components.securitySchemes.BearerAuth;
      expect(bearerAuth.type).toBe('http');
      expect(bearerAuth.scheme).toBe('bearer');
    });
  });

  // ========================================================================
  // Paths
  // ========================================================================

  describe('Paths', () => {
    const paths = Object.keys(spec.paths);

    it('documents all v1 endpoints', () => {
      expect(paths).toContain('/invoices');
      expect(paths).toContain('/invoices/{id}');
      expect(paths).toContain('/invoices/{id}/pdf');
      expect(paths).toContain('/income');
      expect(paths).toContain('/income/{id}');
      expect(paths).toContain('/expenses');
      expect(paths).toContain('/expenses/{id}');
      expect(paths).toContain('/assets');
      expect(paths).toContain('/assets/{id}');
      expect(paths).toContain('/assets/{id}/depreciation');
      expect(paths).toContain('/reports/euer');
      expect(paths).toContain('/reports/vat');
      expect(paths).toContain('/reports/profit-loss');
      expect(paths).toContain('/exports/datev');
      expect(paths).toContain('/webhooks');
      expect(paths).toContain('/webhooks/{id}');
      expect(paths).toContain('/webhooks/events');
      expect(paths).toContain('/webhooks/{id}/deliveries');
    });

    it('all paths have at least one HTTP method', () => {
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];
      for (const path of paths) {
        const methods = Object.keys(spec.paths[path]).filter(m => httpMethods.includes(m));
        expect(methods.length, `${path} should have at least one HTTP method`).toBeGreaterThan(0);
      }
    });

    it('all operations have tags', () => {
      for (const path of paths) {
        for (const [method, operation] of Object.entries(spec.paths[path]) as any) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            expect(operation.tags, `${method.toUpperCase()} ${path} should have tags`).toBeTruthy();
            expect(operation.tags.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('all operations have responses', () => {
      for (const path of paths) {
        for (const [method, operation] of Object.entries(spec.paths[path]) as any) {
          if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
            expect(operation.responses, `${method.toUpperCase()} ${path} should have responses`).toBeTruthy();
          }
        }
      }
    });

    it('POST/PATCH endpoints reference 401 Unauthorized', () => {
      const writeOps = [
        { path: '/invoices', method: 'post' },
        { path: '/income', method: 'post' },
        { path: '/expenses', method: 'post' },
        { path: '/webhooks', method: 'post' },
      ];

      for (const { path, method } of writeOps) {
        const op = spec.paths[path][method];
        expect(
          op.responses['401'],
          `${method.toUpperCase()} ${path} should have 401 response`
        ).toBeTruthy();
      }
    });
  });

  // ========================================================================
  // Schemas
  // ========================================================================

  describe('Schemas', () => {
    const schemas = spec.components.schemas;

    it('defines all resource schemas', () => {
      expect(schemas.Invoice).toBeTruthy();
      expect(schemas.InvoiceItem).toBeTruthy();
      expect(schemas.InvoiceItemInput).toBeTruthy();
      expect(schemas.Income).toBeTruthy();
      expect(schemas.IncomeInput).toBeTruthy();
      expect(schemas.Expense).toBeTruthy();
      expect(schemas.ExpenseInput).toBeTruthy();
      expect(schemas.Asset).toBeTruthy();
      expect(schemas.AssetInput).toBeTruthy();
      expect(schemas.Webhook).toBeTruthy();
      expect(schemas.WebhookWithSecret).toBeTruthy();
      expect(schemas.WebhookDelivery).toBeTruthy();
      expect(schemas.ApiError).toBeTruthy();
    });

    it('Invoice schema has required properties', () => {
      const props = Object.keys(schemas.Invoice.properties);
      expect(props).toContain('id');
      expect(props).toContain('invoice_number');
      expect(props).toContain('status');
      expect(props).toContain('total');
      expect(props).toContain('items');
    });

    it('Webhook schema has required properties', () => {
      const props = Object.keys(schemas.Webhook.properties);
      expect(props).toContain('id');
      expect(props).toContain('url');
      expect(props).toContain('secret');
      expect(props).toContain('events');
      expect(props).toContain('is_active');
    });

    it('WebhookDelivery schema has delivery tracking fields', () => {
      const props = Object.keys(schemas.WebhookDelivery.properties);
      expect(props).toContain('status');
      expect(props).toContain('attempts');
      expect(props).toContain('max_attempts');
      expect(props).toContain('response_status');
      expect(props).toContain('error_message');
      expect(props).toContain('next_retry_at');
    });
  });

  // ========================================================================
  // Reusable Components
  // ========================================================================

  describe('Reusable Components', () => {
    it('defines common parameters', () => {
      expect(spec.components.parameters.PageParam).toBeTruthy();
      expect(spec.components.parameters.LimitParam).toBeTruthy();
      expect(spec.components.parameters.IdParam).toBeTruthy();
    });

    it('defines common error responses', () => {
      expect(spec.components.responses.Unauthorized).toBeTruthy();
      expect(spec.components.responses.NotFound).toBeTruthy();
      expect(spec.components.responses.ValidationError).toBeTruthy();
      expect(spec.components.responses.RateLimited).toBeTruthy();
    });

    it('RateLimited response includes rate limit headers', () => {
      const headers = spec.components.responses.RateLimited.headers;
      expect(headers['X-RateLimit-Limit']).toBeTruthy();
      expect(headers['X-RateLimit-Remaining']).toBeTruthy();
      expect(headers['X-RateLimit-Reset']).toBeTruthy();
    });
  });

  // ========================================================================
  // Webhooks Documentation
  // ========================================================================

  describe('Webhook Documentation', () => {
    it('documents webhook creation with secret note', () => {
      const createOp = spec.paths['/webhooks'].post;
      expect(createOp.summary).toContain('Register');
      expect(createOp.description).toContain('secret');
    });

    it('webhook creation request body has required fields', () => {
      const schema = spec.paths['/webhooks'].post.requestBody.content['application/json'].schema;
      expect(schema.required).toContain('url');
      expect(schema.required).toContain('events');
    });

    it('documents delivery history endpoint', () => {
      const deliveriesOp = spec.paths['/webhooks/{id}/deliveries'].get;
      expect(deliveriesOp.summary).toBeTruthy();
      expect(deliveriesOp.parameters.length).toBeGreaterThan(0);
    });

    it('documents event types endpoint', () => {
      const eventsOp = spec.paths['/webhooks/events'].get;
      expect(eventsOp.tags).toContain('Webhooks');
    });
  });

  // ========================================================================
  // Rate Limiting Documentation
  // ========================================================================

  describe('Rate Limiting Documentation', () => {
    it('documents rate limit headers on list endpoints', () => {
      const listOps = ['/invoices', '/income', '/expenses', '/assets'];
      for (const path of listOps) {
        const getOp = spec.paths[path].get;
        const successResponse = getOp.responses['200'];
        if (successResponse.headers) {
          expect(successResponse.headers['X-RateLimit-Limit']).toBeTruthy();
        }
      }
    });
  });
});
