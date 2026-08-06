import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// Mendaftarkan Service Worker PWA & Web Push Notifications secara otomatis
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      console.log("[ServiceWorker] Registered successfully with scope:", reg.scope);
    }).catch((err) => {
      console.error("[ServiceWorker] Registration failed:", err);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
