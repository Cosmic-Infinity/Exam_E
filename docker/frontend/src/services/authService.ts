/**
 * Auth Service
 * Centralized authentication and API call handling
 * 
 * Handles:
 * - Login/logout with backend validation
 * - Token refresh on 401 errors with automatic retry
 * - Centralized error handling
 * - All API calls with auth error handling
 */

interface LoginResponse {
  message: string;
  university_id: string;
  full_name: string;
  role: string;
}

interface ApiError {
  error?: string;
  detail?: string;
  message?: string;
}

class AuthService {
  private static readonly BASE_URL = "/api";
  private static retryCount = 0;
  private static readonly MAX_RETRIES = 1;

  /**
   * Login user with email and password
   */
  static async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/auth/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Important: Include cookies for HttpOnly JWT
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(error.error || error.detail || "Invalid credentials");
      }

      return await response.json();
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Logout user and invalidate token
   */
  static async logout(): Promise<void> {
    try {
      await fetch(`${this.BASE_URL}/auth/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
      // Don't throw - allow logout even if backend call fails
    }
  }

  /**
   * Get current user info (verify session)
   */
  static async getCurrentUser() {
    try {
      const response = await fetch(`${this.BASE_URL}/me/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to fetch user data");
      }

      return await response.json();
    } catch (error) {
      console.error("Get current user error:", error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/auth/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Token refresh failed");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Token refresh error:", error);
      return false;
    }
  }

  /**
   * Generic API call with automatic token refresh on 401
   * 
   * Usage:
   * const data = await authService.apiCall('/stats/dashboard/data/', {
   *   method: 'GET'
   * });
   */
  static async apiCall(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    const url = endpoint.startsWith("http") ? endpoint : `${this.BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
    });

    // Handle 401 - try to refresh token and retry
    if (response.status === 401 && retryCount < this.MAX_RETRIES) {
      console.log("Token expired, attempting refresh...");
      const refreshed = await this.refreshToken();
      if (refreshed) {
        console.log("Token refreshed, retrying request...");
        return this.apiCall(endpoint, options, retryCount + 1);
      }
    }

    // Handle 401 after retry - user needs to login again
    if (response.status === 401) {
      console.error("Authentication required - redirecting to login");
      window.location.href = "/";
      throw new Error("Authentication required");
    }

    // Other errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error: ${response.status}`, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    return response;
  }

  /**
   * Convenience method for GET requests with auth
   */
  static async get(endpoint: string) {
    const response = await this.apiCall(endpoint, { method: "GET" });
    return response.json();
  }

  /**
   * Convenience method for POST requests with auth
   */
  static async post(endpoint: string, data?: unknown) {
    const response = await this.apiCall(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }

  /**
   * Convenience method for PUT requests with auth
   */
  static async put(endpoint: string, data?: unknown) {
    const response = await this.apiCall(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
    return response.json();
  }

  /**
   * Convenience method for DELETE requests with auth
   */
  static async delete(endpoint: string) {
    const response = await this.apiCall(endpoint, { method: "DELETE" });
    return response.json();
  }
}

export default AuthService;
