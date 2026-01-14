/**
 * Enhanced API Client with interceptors and error handling
 */

import { API_CONFIG, ERROR_MESSAGES } from "./constants";
import type { ApiResponse } from "@/types";

// ============================================================================
// Types
// ============================================================================

interface RequestConfig extends RequestInit {
  params?: Record<string, any>;
  timeout?: number;
  retry?: number;
}

interface RequestInterceptor {
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  onRequestError?: (error: Error) => Error | Promise<Error>;
}

interface ResponseInterceptor {
  onResponse?: (response: Response) => Response | Promise<Response>;
  onResponseError?: (error: Error) => Error | Promise<Error>;
}

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private baseURL: string;
  private defaultTimeout: number;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(baseURL: string = API_CONFIG.BASE_URL) {
    this.baseURL = baseURL;
    this.defaultTimeout = API_CONFIG.TIMEOUT;
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Build URL with query parameters
   */
  private buildURL(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(endpoint, this.baseURL);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Execute request with interceptors
   */
  private async executeRequest(
    url: string,
    config: RequestConfig
  ): Promise<Response> {
    let requestConfig = { ...config };

    // Run request interceptors
    for (const interceptor of this.requestInterceptors) {
      if (interceptor.onRequest) {
        try {
          requestConfig = await interceptor.onRequest(requestConfig);
        } catch (error) {
          if (interceptor.onRequestError) {
            throw await interceptor.onRequestError(error as Error);
          }
          throw error;
        }
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = config.timeout || this.defaultTimeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...requestConfig,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Run response interceptors
      let finalResponse = response;
      for (const interceptor of this.responseInterceptors) {
        if (interceptor.onResponse) {
          try {
            finalResponse = await interceptor.onResponse(finalResponse);
          } catch (error) {
            if (interceptor.onResponseError) {
              throw await interceptor.onResponseError(error as Error);
            }
            throw error;
          }
        }
      }

      return finalResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      // Run error interceptors
      for (const interceptor of this.responseInterceptors) {
        if (interceptor.onResponseError) {
          throw await interceptor.onResponseError(error as Error);
        }
      }

      throw error;
    }
  }

  /**
   * Parse response
   */
  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      let errorMessage: string = ERROR_MESSAGES.GENERIC;

      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } else {
        const textError = await response.text();
        errorMessage = textError || errorMessage;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    if (contentType?.includes("application/json")) {
      const data = await response.json();
      return {
        success: true,
        data,
      };
    }

    return {
      success: true,
      data: (await response.text()) as any,
    };
  }

  /**
   * GET request
   */
  async get<T = any>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint, config?.params);
    const response = await this.executeRequest(url, {
      ...config,
      method: "GET",
    });
    return this.parseResponse<T>(response);
  }

  /**
   * POST request
   */
  async post<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint, config?.params);
    const response = await this.executeRequest(url, {
      ...config,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config?.headers,
      },
      body: JSON.stringify(data),
    });
    return this.parseResponse<T>(response);
  }

  /**
   * PUT request
   */
  async put<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint, config?.params);
    const response = await this.executeRequest(url, {
      ...config,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...config?.headers,
      },
      body: JSON.stringify(data),
    });
    return this.parseResponse<T>(response);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint, config?.params);
    const response = await this.executeRequest(url, {
      ...config,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...config?.headers,
      },
      body: JSON.stringify(data),
    });
    return this.parseResponse<T>(response);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint, config?.params);
    const response = await this.executeRequest(url, {
      ...config,
      method: "DELETE",
    });
    return this.parseResponse<T>(response);
  }

  /**
   * Upload file
   */
  async upload<T = any>(
    endpoint: string,
    file: File,
    fieldName: string = "file",
    additionalData?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(fieldName, file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const url = this.buildURL(endpoint);
    const response = await this.executeRequest(url, {
      method: "POST",
      body: formData,
    });

    return this.parseResponse<T>(response);
  }
}

// ============================================================================
// Create instance and configure interceptors
// ============================================================================

const apiClient = new ApiClient();

// Request interceptor to add auth token
apiClient.addRequestInterceptor({
  onRequest: (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token");
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }
    return config;
  },
});

// Response interceptor to handle 401
apiClient.addResponseInterceptor({
  onResponse: (response) => {
    if (response.status === 401) {
      // Handle unauthorized - clear token and redirect to login
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        window.location.href = "/login";
      }
    }
    return response;
  },
});

export default apiClient;
export { ApiClient };
export type { RequestConfig, RequestInterceptor, ResponseInterceptor };
