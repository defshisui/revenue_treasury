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
// ============================================================
const _originalFetch = window.fetch.bind(window);
const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  const isBackendCall = url.startsWith(API_ORIGIN) || url.startsWith("/");
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

  return _originalFetch(input, init);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
