import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/globals.css";
import { registerSW } from 'virtual:pwa-register';

console.log("[Main] Starting React application...");

// Global error handler for uncaught errors (helps debug white pages on mobile)
window.addEventListener("error", (event) => {
  console.error("[Global Error]", event.error?.message || event.message, event.error?.stack);
  // Show error on screen if root is empty (white page scenario)
  const root = document.getElementById("root");
  if (root && !root.children.length) {
    // Create error display safely without innerHTML to avoid XSS
    const container = document.createElement('div');
    container.style.cssText = 'padding:2rem;font-family:system-ui';
    
    const heading = document.createElement('h2');
    heading.style.color = '#ef4444';
    heading.textContent = 'App Error';
    
    const errorPre = document.createElement('pre');
    errorPre.style.cssText = 'white-space:pre-wrap;font-size:12px;background:#f1f5f9;padding:1rem;border-radius:8px;overflow:auto';
    errorPre.textContent = event.error?.stack || event.message || 'Unknown error';
    
    const reloadBtn = document.createElement('button');
    reloadBtn.style.cssText = 'margin-top:1rem;padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer';
    reloadBtn.textContent = 'Reload';
    reloadBtn.onclick = () => location.reload();
    
    container.appendChild(heading);
    container.appendChild(errorPre);
    container.appendChild(reloadBtn);
    root.appendChild(container);
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

// Register service worker for PWA functionality
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New version available! Click OK to update.')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('[PWA] App ready to work offline');
  },
  onRegistered(registration) {
    console.log('[PWA] Service Worker registered:', registration);
  },
  onRegisterError(error) {
    console.error('[PWA] Service Worker registration error:', error);
  },
});
