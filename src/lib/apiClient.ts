export interface ApiError {
  error: string;
  status: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("workbuddy_auth_session");
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.token || session?.access_token || null;
  } catch {
    return null;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});

  headers.set("Content-Type", "application/json");

  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errJson.message || errorMsg;
    } catch {
      // Non-JSON error
    }
    const err: ApiError = { error: errorMsg, status: response.status };
    throw err;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { ...options, method: "GET" }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { ...options, method: "DELETE" }),
};
