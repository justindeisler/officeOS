import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/globals.css";

console.log("[Main] Starting React application...");

// Global error handler for uncaught errors (helps debug white pages on mobile)
window.addEventListener("error", (event) => {
  console.error("[Global Error]", event.error?.message || event.message, event.error?.stack);
  // Show error on screen if root is empty (white page scenario)
  const root = document.getElementById("root");
  if (root && !root.children.length) {
    root.innerHTML = `<div style="padding:2rem;font-family:system-ui">
      <h2 style="color:#ef4444">App Error</h2>
      <pre style="white-space:pre-wrap;font-size:12px;background:#f1f5f9;padding:1rem;border-radius:8px;overflow:auto">${event.error?.stack || event.message}</pre>
      <button onclick="location.reload()" style="margin-top:1rem;padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:6px">Reload</button>
    </div>`;
  }
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
