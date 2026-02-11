/**
 * Centralized HTTP Client
 *
 * A typed fetch wrapper providing:
 * - Automatic auth header injection
 * - Consistent error handling (ApiError, NetworkError)
 * - Request/response/error interceptors
 * - Global loading state tracking
 * - JSON and blob response support
 *
 * Used by both admin (pa-auth) and client portal (client-auth) APIs.
 */

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Represents an API error response (non-2xx status).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True for 401 Unauthorized */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** True for 403 Forbidden */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** True for 404 Not Found */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** True for 422 Unprocessable Entity (validation errors) */
  get isValidationError(): boolean {
    return this.status === 422;
  }

  /** True for 5xx server errors */
  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * Represents a network-level failure (no response received).
 */
export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

// ============================================================================
// INTERCEPTOR TYPES
// ============================================================================

export interface RequestConfig extends RequestInit {
  url: string;
}

export type RequestInterceptor = (
  config: RequestConfig,
) => RequestConfig | Promise<RequestConfig>;

export type ResponseInterceptor = (
  response: Response,
  config: RequestConfig,
) => Response | Promise<Response>;

export type ErrorInterceptor = (error: ApiError) => void;

// ============================================================================
// LOADING STATE
// ============================================================================

let activeRequests = 0;
const loadingListeners = new Set<(loading: boolean) => void>();

function notifyLoading(loading: boolean): void {
  loadingListeners.forEach((listener) => listener(loading));
}

/**
 * Subscribe to global loading state changes.
 * Returns an unsubscribe function.
 *
 * @example
 * const unsub = onLoadingChange((isLoading) => {
 *   setGlobalLoading(isLoading);
 * });
 */
export function onLoadingChange(
  listener: (loading: boolean) => void,
): () => void {
  loadingListeners.add(listener);
  return () => {
    loadingListeners.delete(listener);
  };
}

/**
 * Get the current number of in-flight requests.
 */
export function getActiveRequestCount(): number {
  return activeRequests;
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

export interface HttpClientOptions {
  /** Base URL for all requests (e.g., '/api' or 'https://example.com/api') */
  baseUrl: string;
  /** Function to retrieve the current auth token (or null if unauthenticated) */
  getToken: () => string | null;
  /** Called when a 401 response is received (e.g., to trigger logout) */
  onAuthError?: () => void;
}

export class HttpClient {
  private baseUrl: string;
  private getToken: () => string | null;
  private onAuthError?: () => void;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private errorInterceptors: ErrorInterceptor[] = [];

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.getToken = options.getToken;
    this.onAuthError = options.onAuthError;
  }

  // --------------------------------------------------------------------------
  // Interceptors
  // --------------------------------------------------------------------------

  /** Add a request interceptor. Returns unsubscribe function. */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor);
    return () => {
      this.requestInterceptors = this.requestInterceptors.filter(
        (i) => i !== interceptor,
      );
    };
  }

  /** Add a response interceptor. Returns unsubscribe function. */
  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor);
    return () => {
      this.responseInterceptors = this.responseInterceptors.filter(
        (i) => i !== interceptor,
      );
    };
  }

  /** Add an error interceptor (called on API errors). Returns unsubscribe function. */
  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor);
    return () => {
      this.errorInterceptors = this.errorInterceptors.filter(
        (i) => i !== interceptor,
      );
    };
  }

  // --------------------------------------------------------------------------
  // Core request methods
  // --------------------------------------------------------------------------

  /**
   * Make an authenticated JSON request.
   * Automatically sets Content-Type and Authorization headers.
   */
  async request<T>(path: string, options?: RequestInit): Promise<T> {
    let config: RequestConfig = {
      url: `${this.baseUrl}${path}`,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...(options?.headers || {}),
      },
    };

    // Run request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = await interceptor(config);
    }

    activeRequests++;
    if (activeRequests === 1) notifyLoading(true);

    try {
      const { url, ...init } = config;
      let response = await fetch(url, init);

      // Run response interceptors
      for (const interceptor of this.responseInterceptors) {
        response = await interceptor(response, config);
      }

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        // Extract a string message — data.error or data.message may be objects
        const rawMsg = data.error || data.message;
        const errorMessage = typeof rawMsg === 'string'
          ? rawMsg
          : (typeof rawMsg === 'object' && rawMsg !== null && typeof rawMsg.message === 'string')
            ? rawMsg.message
            : `Request failed: ${response.statusText}`;
        const error = new ApiError(
          errorMessage,
          response.status,
          response.statusText,
          data,
        );

        // Handle 401
        if (error.isUnauthorized && this.onAuthError) {
          this.onAuthError();
        }

        // Run error interceptors
        for (const interceptor of this.errorInterceptors) {
          interceptor(error);
        }

        throw error;
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network request failed — check your connection', error);
      }
      throw new NetworkError(
        'Network request failed',
        error instanceof Error ? error : undefined,
      );
    } finally {
      activeRequests--;
      if (activeRequests === 0) notifyLoading(false);
    }
  }

  /**
   * Make an authenticated request that returns a Blob (for file downloads).
   * Does NOT set Content-Type to application/json.
   */
  async requestBlob(path: string, options?: RequestInit): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    activeRequests++;
    if (activeRequests === 1) notifyLoading(true);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        const rawMsg = data.error || data.message;
        const errorMessage = typeof rawMsg === 'string'
          ? rawMsg
          : (typeof rawMsg === 'object' && rawMsg !== null && typeof rawMsg.message === 'string')
            ? rawMsg.message
            : 'Download failed';
        throw new ApiError(
          errorMessage,
          response.status,
          response.statusText,
          data,
        );
      }

      return response.blob();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new NetworkError(
        'Network request failed',
        error instanceof Error ? error : undefined,
      );
    } finally {
      activeRequests--;
      if (activeRequests === 0) notifyLoading(false);
    }
  }

  // --------------------------------------------------------------------------
  // Convenience methods
  // --------------------------------------------------------------------------

  /** GET request */
  get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /** POST request with JSON body */
  post<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /** PUT request with JSON body */
  put<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /** PATCH request with JSON body */
  patch<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  /** DELETE request */
  delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
