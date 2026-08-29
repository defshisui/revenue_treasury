import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./legacy-styles.css";
import App from "./App.tsx";

import { ThemeProvider } from "./components/ThemeContext";

// ============================================================
// Global fetch interceptor — automatically attaches the JWT
// Authorization header to every backend API request.
// The /login endpoint is excluded so unauthenticated requests
// still pass through without a token.
// A 401 response clears storage and redirects to the login page.
// ============================================================
const _originalFetch = window.fetch.bind(window);
const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  const isBackendCall = url.startsWith(API_ORIGIN) || (url.startsWith("/") && !url.startsWith("//"));
  const isLoginRoute = url.includes("/login");

  if (isBackendCall && !isLoginRoute) {
    const token = localStorage.getItem("token");
    if (token) {
      init = init ?? {};
      init.headers = {
        ...(init.headers instanceof Headers
          ? Object.fromEntries((init.headers as Headers).entries())
          : (init.headers as Record<string, string> ?? {})),
        Authorization: `Bearer ${token}`,
      };
    }
  }

  const response = await _originalFetch(input, init);

  // Auto-redirect on 401 — token missing/expired, send user back to login
  if (response.status === 401 && isBackendCall && !isLoginRoute) {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("user");
    localStorage.removeItem("user_role");
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("user");
    // Avoid redirect loops — only redirect if not already on the login page
    if (!window.location.pathname.includes("/login") && window.location.pathname !== "/") {
      window.location.href = "/";
    }
  }

  return response;
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
