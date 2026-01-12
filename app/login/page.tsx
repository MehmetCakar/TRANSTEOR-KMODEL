// app/login/page.tsx

"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Lütfen e-posta ve şifreyi girin.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Giriş yapılamadı. Bilgilerinizi kontrol edin.");
        return;
      }
      
      router.push(data.isAdmin ? "/admin" : "/dashboard");
    } catch (err) {
      setError("Sunucuya ulaşılamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page relative">
      <div className="blob blob-1"></div>
      <div className="auth-card glass">
        <div className="auth-card-inner">
          <header className="auth-header text-center">
            <div className="auth-icon-circle"><Lock size={24} /></div>
            <h1 className="auth-title">Tekrar Hoş Geldin</h1>
            <p className="auth-subtitle">
              Eğitim içeriklerine erişmek ve ilerlemeni görmek için giriş yap. 💙
            </p>
          </header>

          {error && <div className="auth-error animate-shake">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label htmlFor="email"><Mail size={16} /> E-posta</label>
              <input
                id="email"
                type="email"
                className="auth-input"
                placeholder="ornek@eposta.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="password"><Lock size={16} /> Şifre</label>
              <input
                id="password"
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? "Giriş yapılıyor..." : <><LogIn size={18} /> Giriş Yap</>}
            </button>
          </form>

          <p className="auth-footer">
            Henüz hesabın yok mu? <Link href="/register">Ücretsiz Kayıt Ol</Link>
          </p>
        </div>
      </div>
    </div>
  );
}