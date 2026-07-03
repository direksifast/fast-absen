import { useState } from "react";
import { Lock, LogIn, AlertCircle } from "lucide-react";

export function AdminLogin({ onLogin, onBack }: { onLogin: () => void; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // HARDCODED UNTUK SEMENTARA.
    // Nanti diganti dengan Supabase Auth (email/password).
    if (password === "admin123") {
      onLogin();
    } else {
      setError("Password salah! (Hint: admin123)");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-8 border border-border">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-center text-foreground mb-2">Login Admin</h2>
        <p className="text-center text-muted-foreground text-sm mb-8">Masukkan password untuk mengakses panel admin FAST ABSEN.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="••••••••"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!password}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" /> Masuk Panel Admin
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <button onClick={onBack} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Kembali ke Menu Utama
          </button>
        </div>
      </div>
    </div>
  );
}
