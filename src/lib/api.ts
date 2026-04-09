// Auth-aware fetch wrapper that includes the access token from localStorage
import { useAuthStore } from "@/stores/auth-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function authFetch(endpoint: string, options: RequestInit = {}) {
  const accessToken = useAuthStore.getState().accessToken;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  
  // Add Authorization header if we have a token
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });
  
  return response;
}

// Simple API helpers
export const api = {
  get: (endpoint: string) => authFetch(endpoint),
  post: (endpoint: string, body: unknown) => 
    authFetch(endpoint, { method: "POST", body: JSON.stringify(body) }),
  put: (endpoint: string, body: unknown) => 
    authFetch(endpoint, { method: "PUT", body: JSON.stringify(body) }),
  delete: (endpoint: string) => 
    authFetch(endpoint, { method: "DELETE" }),
};
