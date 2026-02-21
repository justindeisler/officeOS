/**
 * OpenAPI 3.0 Specification for officeOS Public REST API v1
 *
 * Generates the full OpenAPI spec from a central definition.
 * Served at /api/docs via Swagger UI.
 */

export function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'officeOS Public REST API',
      version: '1.0.0',
      description: 'Public REST API for officeOS — business management for freelancers. Manage invoices, income, expenses, assets, reports, and webhooks.',
      contact: {
        name: 'officeOS API Support',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    security: [
      { BearerAuth: [] },
    ],
    tags: [
      { name: 'Invoices', description: 'Invoice management (CRUD + PDF generation)' },
      { name: 'Income', description: 'Income record management' },
      { name: 'Expenses', description: 'Expense record management' },
      { name: 'Assets', description: 'Asset management with depreciation' },
      { name: 'Reports', description: 'Financial reports (EÜR, VAT, BWA)' },
      { name: 'Exports', description: 'Data exports (DATEV, CSV)' },
      { name: 'Webhooks', description: 'Webhook registration and delivery management' },
    ],
    paths: {
      // ====== INVOICES ======
      '/invoices': {
        get: {
          tags: ['Invoices'],
          summary: 'List invoices',
          description: 'Returns a paginated list of invoices. Supports filtering by status and client.',
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] },
              description: 'Filter by invoice status',
            },
            {
              name: 'client_id',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by client ID',
            },
          ],
          responses: {
            '200': {
              description: 'Paginated list of invoices',
              headers: { ...rateLimitHeaders() },
              content: {
                'application/json': {
                  schema: paginatedResponse('Invoice'),
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
        post: {
          tags: ['Invoices'],
          summary: 'Create invoice',
          description: 'Create a new invoice with line items. Invoice number is auto-generated.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    client_id: { type: 'string', description: 'Client ID' },
                    project_id: { type: 'string', description: 'Project ID' },
                    invoice_date: { type: 'string', format: 'date', description: 'Invoice date (defaults to today)' },
                    due_date: { type: 'string', format: 'date', description: 'Due date (defaults to +14 days)' },
                    vat_rate: { type: 'number', default: 19, description: 'VAT rate in percent' },
                    notes: { type: 'string' },
                    items: {
                      type: 'array',
                      minItems: 1,
                      items: { $ref: '#/components/schemas/InvoiceItemInput' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Invoice created',
              headers: { ...rateLimitHeaders() },
              content: { 'application/json': { schema: successResponse('Invoice') } },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/invoices/{id}': {
        get: {
          tags: ['Invoices'],
          summary: 'Get invoice',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Invoice details',
              headers: { ...rateLimitHeaders() },
              content: { 'application/json': { schema: successResponse('Invoice') } },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        patch: {
          tags: ['Invoices'],
          summary: 'Update invoice',
          description: 'Update a draft invoice. Only draft invoices can be modified.',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    client_id: { type: 'string' },
                    project_id: { type: 'string' },
                    invoice_date: { type: 'string', format: 'date' },
                    due_date: { type: 'string', format: 'date' },
                    vat_rate: { type: 'number' },
                    notes: { type: 'string' },
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/InvoiceItemInput' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Invoice updated',
              content: { 'application/json': { schema: successResponse('Invoice') } },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '404': { $ref: '#/components/responses/NotFound' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        delete: {
          tags: ['Invoices'],
          summary: 'Delete invoice',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Invoice deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          deleted: { type: 'boolean', example: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/invoices/{id}/pdf': {
        get: {
          tags: ['Invoices'],
          summary: 'Download invoice PDF',
          description: 'Generate and download the invoice as PDF.',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'PDF file',
              content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '500': { description: 'PDF generation failed' },
          },
        },
      },

      // ====== INCOME ======
      '/income': {
        get: {
          tags: ['Income'],
          summary: 'List income records',
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
            { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Filter by year' },
          ],
          responses: {
            '200': {
              description: 'Paginated income records',
              headers: { ...rateLimitHeaders() },
              content: { 'application/json': { schema: paginatedResponse('Income') } },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['Income'],
          summary: 'Create income record',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IncomeInput' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Income created',
              content: { 'application/json': { schema: successResponse('Income') } },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/income/{id}': {
        get: {
          tags: ['Income'],
          summary: 'Get income record',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': { description: 'Income record', content: { 'application/json': { schema: successResponse('Income') } } },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['Income'],
          summary: 'Update income record',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/IncomeInput' } } },
          },
          responses: {
            '200': { description: 'Income updated', content: { 'application/json': { schema: successResponse('Income') } } },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Income'],
          summary: 'Delete income record',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': { description: 'Income deleted' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },

      // ====== EXPENSES ======
      '/expenses': {
        get: {
          tags: ['Expenses'],
          summary: 'List expense records',
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
            { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Filter by year' },
            { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
          ],
          responses: {
            '200': {
              description: 'Paginated expenses',
              headers: { ...rateLimitHeaders() },
              content: { 'application/json': { schema: paginatedResponse('Expense') } },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['Expenses'],
          summary: 'Create expense record',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExpenseInput' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Expense created',
              content: { 'application/json': { schema: successResponse('Expense') } },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/expenses/{id}': {
        get: {
          tags: ['Expenses'],
          summary: 'Get expense record',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': { description: 'Expense record', content: { 'application/json': { schema: successResponse('Expense') } } },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['Expenses'],
          summary: 'Update expense record',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ExpenseInput' } } },
          },
          responses: {
            '200': { description: 'Expense updated', content: { 'application/json': { schema: successResponse('Expense') } } },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Expenses'],
          summary: 'Delete expense record',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': { description: 'Expense deleted' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },

      // ====== ASSETS ======
      '/assets': {
        get: {
          tags: ['Assets'],
          summary: 'List assets',
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'disposed'] } },
          ],
          responses: {
            '200': {
              description: 'Paginated assets',
              headers: { ...rateLimitHeaders() },
              content: { 'application/json': { schema: paginatedResponse('Asset') } },
            },
          },
        },
        post: {
          tags: ['Assets'],
          summary: 'Create asset',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AssetInput' },
              },
            },
          },
          responses: {
            '201': { description: 'Asset created', content: { 'application/json': { schema: successResponse('Asset') } } },
            '400': { $ref: '#/components/responses/ValidationError' },
          },
        },
      },
      '/assets/{id}': {
        get: {
          tags: ['Assets'],
          summary: 'Get asset',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': { description: 'Asset details', content: { 'application/json': { schema: successResponse('Asset') } } },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['Assets'],
          summary: 'Update asset',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AssetInput' } } },
          },
          responses: {
            '200': { description: 'Asset updated' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Assets'],
          summary: 'Delete asset',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': { description: 'Asset deleted' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/assets/{id}/depreciation': {
        get: {
          tags: ['Assets'],
          summary: 'Get depreciation schedule',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Depreciation schedule',
              content: {
                'application/json': {
                  schema: successResponse('DepreciationSchedule'),
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },

      // ====== REPORTS ======
      '/reports/euer': {
        get: {
          tags: ['Reports'],
          summary: 'EÜR report (Einnahmenüberschussrechnung)',
          parameters: [
            { name: 'year', in: 'query', required: true, schema: { type: 'integer' }, description: 'Tax year' },
          ],
          responses: {
            '200': { description: 'EÜR report data', content: { 'application/json': { schema: successResponse('EuerReport') } } },
          },
        },
      },
      '/reports/vat': {
        get: {
          tags: ['Reports'],
          summary: 'VAT report (Umsatzsteuervoranmeldung)',
          parameters: [
            { name: 'year', in: 'query', required: true, schema: { type: 'integer' } },
            { name: 'period', in: 'query', schema: { type: 'string' }, description: 'Period (e.g., Q1, M01)' },
          ],
          responses: {
            '200': { description: 'VAT report data' },
          },
        },
      },
      '/reports/profit-loss': {
        get: {
          tags: ['Reports'],
          summary: 'Profit & Loss report',
          parameters: [
            { name: 'year', in: 'query', required: true, schema: { type: 'integer' } },
          ],
          responses: {
            '200': { description: 'P&L report data' },
          },
        },
      },

      // ====== EXPORTS ======
      '/exports/datev': {
        get: {
          tags: ['Exports'],
          summary: 'DATEV export',
          parameters: [
            { name: 'year', in: 'query', required: true, schema: { type: 'integer' } },
            { name: 'month', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            '200': { description: 'DATEV CSV data' },
          },
        },
      },

      // ====== WEBHOOKS ======
      '/webhooks': {
        get: {
          tags: ['Webhooks'],
          summary: 'List webhooks',
          description: 'List all webhooks registered for the current API key.',
          responses: {
            '200': {
              description: 'List of webhooks',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Webhook' },
                      },
                    },
                  },
                },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['Webhooks'],
          summary: 'Register webhook',
          description: 'Register a new webhook. The secret is returned only on creation — store it securely for signature verification.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url', 'events'],
                  properties: {
                    url: {
                      type: 'string',
                      format: 'uri',
                      example: 'https://example.com/webhooks/officeos',
                      description: 'HTTPS endpoint to receive webhook events',
                    },
                    events: {
                      type: 'array',
                      items: { type: 'string', enum: ['invoice.created', 'invoice.updated', 'invoice.paid', 'expense.created', 'task.completed', '*'] },
                      example: ['invoice.created', 'invoice.paid'],
                      description: 'Event types to subscribe to. Use "*" for all events.',
                    },
                    description: {
                      type: 'string',
                      example: 'Production webhook for accounting sync',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Webhook created (full secret included — store it!)',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      data: { $ref: '#/components/schemas/WebhookWithSecret' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
      },
      '/webhooks/events': {
        get: {
          tags: ['Webhooks'],
          summary: 'List event types',
          description: 'Returns all available webhook event types.',
          responses: {
            '200': {
              description: 'List of event types',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'array',
                        items: { type: 'string' },
                        example: ['invoice.created', 'invoice.paid', 'expense.created', 'task.completed'],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/webhooks/{id}': {
        get: {
          tags: ['Webhooks'],
          summary: 'Get webhook',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': {
              description: 'Webhook details',
              content: { 'application/json': { schema: successResponse('Webhook') } },
            },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        patch: {
          tags: ['Webhooks'],
          summary: 'Update webhook',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', format: 'uri' },
                    events: { type: 'array', items: { type: 'string' } },
                    description: { type: 'string' },
                    is_active: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Webhook updated', content: { 'application/json': { schema: successResponse('Webhook') } } },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        delete: {
          tags: ['Webhooks'],
          summary: 'Delete webhook',
          parameters: [{ $ref: '#/components/parameters/IdParam' }],
          responses: {
            '200': { description: 'Webhook deleted' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/webhooks/{id}/deliveries': {
        get: {
          tags: ['Webhooks'],
          summary: 'Delivery history',
          description: 'Get the delivery history for a webhook, including status, attempts, and response details.',
          parameters: [
            { $ref: '#/components/parameters/IdParam' },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20, maximum: 100 },
              description: 'Max number of deliveries to return',
            },
          ],
          responses: {
            '200': {
              description: 'Delivery history',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/WebhookDelivery' },
                      },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key authentication. Generate keys via the admin panel at /api/admin/api-keys.',
        },
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', default: 1, minimum: 1 },
          description: 'Page number',
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          description: 'Items per page',
        },
        IdParam: {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Resource ID',
        },
      },
      schemas: {
        // ---- Invoice ----
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            invoice_number: { type: 'string', example: 'RE-2024-001' },
            invoice_date: { type: 'string', format: 'date' },
            due_date: { type: 'string', format: 'date' },
            status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'] },
            client_id: { type: 'string', nullable: true },
            project_id: { type: 'string', nullable: true },
            subtotal: { type: 'number', format: 'decimal' },
            vat_rate: { type: 'number' },
            vat_amount: { type: 'number', format: 'decimal' },
            total: { type: 'number', format: 'decimal' },
            payment_date: { type: 'string', format: 'date', nullable: true },
            notes: { type: 'string', nullable: true },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/InvoiceItem' },
            },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        InvoiceItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            description: { type: 'string' },
            quantity: { type: 'number' },
            unit: { type: 'string', default: 'hours' },
            unit_price: { type: 'number', format: 'decimal' },
            amount: { type: 'number', format: 'decimal' },
          },
        },
        InvoiceItemInput: {
          type: 'object',
          required: ['description', 'quantity', 'unit_price'],
          properties: {
            description: { type: 'string', example: 'Web Development' },
            quantity: { type: 'number', example: 10 },
            unit: { type: 'string', default: 'hours' },
            unit_price: { type: 'number', example: 100 },
            vat_rate: { type: 'number', description: 'Per-item VAT rate override' },
          },
        },

        // ---- Income ----
        Income: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            date: { type: 'string', format: 'date' },
            client_id: { type: 'string', nullable: true },
            invoice_id: { type: 'string', nullable: true },
            description: { type: 'string' },
            net_amount: { type: 'number' },
            vat_rate: { type: 'number' },
            vat_amount: { type: 'number' },
            gross_amount: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        IncomeInput: {
          type: 'object',
          required: ['date', 'description', 'net_amount'],
          properties: {
            date: { type: 'string', format: 'date' },
            client_id: { type: 'string' },
            invoice_id: { type: 'string' },
            description: { type: 'string' },
            net_amount: { type: 'number' },
            vat_rate: { type: 'number', default: 19 },
            payment_method: { type: 'string' },
          },
        },

        // ---- Expense ----
        Expense: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            date: { type: 'string', format: 'date' },
            vendor: { type: 'string', nullable: true },
            description: { type: 'string' },
            category: { type: 'string' },
            net_amount: { type: 'number' },
            vat_rate: { type: 'number' },
            vat_amount: { type: 'number' },
            gross_amount: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        ExpenseInput: {
          type: 'object',
          required: ['date', 'description', 'category', 'net_amount'],
          properties: {
            date: { type: 'string', format: 'date' },
            vendor: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            net_amount: { type: 'number' },
            vat_rate: { type: 'number', default: 19 },
            payment_method: { type: 'string' },
            receipt_path: { type: 'string' },
          },
        },

        // ---- Asset ----
        Asset: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            category: { type: 'string' },
            purchase_date: { type: 'string', format: 'date' },
            purchase_price: { type: 'number' },
            useful_life_years: { type: 'integer' },
            depreciation_method: { type: 'string', enum: ['linear', 'declining'] },
            current_value: { type: 'number' },
            status: { type: 'string', enum: ['active', 'disposed'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        AssetInput: {
          type: 'object',
          required: ['name', 'category', 'purchase_date', 'purchase_price', 'useful_life_years'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            purchase_date: { type: 'string', format: 'date' },
            purchase_price: { type: 'number' },
            useful_life_years: { type: 'integer' },
            depreciation_method: { type: 'string', enum: ['linear', 'declining'], default: 'linear' },
            salvage_value: { type: 'number', default: 0 },
          },
        },
        DepreciationSchedule: {
          type: 'object',
          properties: {
            asset_id: { type: 'string' },
            schedule: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  year: { type: 'integer' },
                  depreciation_amount: { type: 'number' },
                  accumulated_depreciation: { type: 'number' },
                  book_value: { type: 'number' },
                },
              },
            },
          },
        },

        // ---- Reports ----
        EuerReport: {
          type: 'object',
          properties: {
            year: { type: 'integer' },
            total_income: { type: 'number' },
            total_expenses: { type: 'number' },
            profit: { type: 'number' },
            lines: { type: 'object' },
          },
        },

        // ---- Webhook ----
        Webhook: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            secret: { type: 'string', description: 'Masked secret (prefix only)' },
            events: {
              type: 'array',
              items: { type: 'string' },
            },
            is_active: { type: 'boolean' },
            description: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        WebhookWithSecret: {
          type: 'object',
          description: 'Webhook with full secret (only returned on creation)',
          properties: {
            id: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            secret: {
              type: 'string',
              description: 'Full webhook secret for HMAC verification. Store this securely — it is never shown again.',
              example: 'whsec_a1b2c3d4e5f6...',
            },
            events: {
              type: 'array',
              items: { type: 'string' },
            },
            is_active: { type: 'boolean' },
            description: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        WebhookDelivery: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            webhook_id: { type: 'string' },
            event_type: { type: 'string' },
            payload: { type: 'string', description: 'JSON payload sent' },
            status: { type: 'string', enum: ['pending', 'success', 'failed'] },
            attempts: { type: 'integer' },
            max_attempts: { type: 'integer', example: 5 },
            last_attempt_at: { type: 'string', format: 'date-time', nullable: true },
            next_retry_at: { type: 'string', format: 'date-time', nullable: true },
            response_status: { type: 'integer', nullable: true },
            response_body: { type: 'string', nullable: true },
            error_message: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            completed_at: { type: 'string', format: 'date-time', nullable: true },
          },
        },

        // ---- Envelope ----
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid API key',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
              example: {
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
              example: {
                success: false,
                error: { code: 'NOT_FOUND', message: 'Resource not found' },
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
              example: {
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
              },
            },
          },
        },
        RateLimited: {
          description: 'Rate limit exceeded',
          headers: {
            'X-RateLimit-Limit': { schema: { type: 'integer' }, description: 'Requests allowed per window' },
            'X-RateLimit-Remaining': { schema: { type: 'integer' }, description: 'Requests remaining' },
            'X-RateLimit-Reset': { schema: { type: 'string', format: 'date-time' }, description: 'Window reset time' },
          },
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
              example: {
                success: false,
                error: {
                  code: 'RATE_LIMIT_EXCEEDED',
                  message: 'Rate limit exceeded',
                  details: { limit: 100, window_minutes: 1, retry_after: 60 },
                },
              },
            },
          },
        },
      },
    },
  };
}

// ============================================================================
// Helper functions for DRY spec generation
// ============================================================================

function rateLimitHeaders() {
  return {
    'X-RateLimit-Limit': {
      schema: { type: 'integer' },
      description: 'Maximum requests per minute for this API key',
    },
    'X-RateLimit-Remaining': {
      schema: { type: 'integer' },
      description: 'Remaining requests in current window',
    },
    'X-RateLimit-Reset': {
      schema: { type: 'string', format: 'date-time' },
      description: 'Timestamp when the rate limit window resets',
    },
  };
}

function successResponse(schemaName: string) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { $ref: `#/components/schemas/${schemaName}` },
    },
  };
}

function paginatedResponse(schemaName: string) {
  return {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'array',
        items: { $ref: `#/components/schemas/${schemaName}` },
      },
      meta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  };
}
