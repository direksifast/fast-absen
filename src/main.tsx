import { Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught React Error:", error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    } catch {}
    window.location.href = "/?reset=" + Date.now();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          backgroundColor: "#F8FAFC",
          color: "#0F172A",
          textAlign: "center"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "20px",
            backgroundColor: "#EFF6FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "32px",
            marginBottom: "16px",
            border: "1px solid #DBEAFE"
          }}>
            ⚡
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px", color: "#1E293B" }}>
            Aplikasi Perlu Disegarkan
          </h2>
          <p style={{ fontSize: "13px", color: "#64748B", maxWidth: "340px", marginBottom: "24px", lineHeight: "1.5" }}>
            Terdapat penyesuaian cache versi di HP Anda. Silakan klik tombol di bawah untuk memuat ulang versi terbaru.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              backgroundColor: "#1B3E7A",
              color: "#FFFFFF",
              border: "none",
              padding: "14px 28px",
              borderRadius: "14px",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(27, 62, 122, 0.25)"
            }}
          >
            Segarkan & Muat Ulang 🔄
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Mendaftarkan Service Worker PWA & Web Push Notifications
if ("serviceWorker" in navigator) {
  // Register service worker
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      console.log("[ServiceWorker] Registered successfully with scope:", reg.scope);
      
      // Cek update setiap kali tab dibuka kembali (dari background)
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          reg.update();
        }
      });
    }).catch((err) => {
      console.error("[ServiceWorker] Registration failed:", err);
    });
  });

  // Otomatis refresh halaman ketika ada Service Worker baru yang terinstal (versi baru)
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
