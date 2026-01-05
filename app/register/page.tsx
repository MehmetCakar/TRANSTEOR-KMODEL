"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, Mail, Lock, ShieldCheck } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password || !passwordAgain) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }
    if (password !== passwordAgain) {
      setError("Şifreler birbiriyle uyuşmuyor.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Kayıt sırasında bir hata oluştu.");
        return;
      }
      router.push(`/verify?email=${encodeURIComponent(email)}`);
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page relative">
      <div className="blob blob-2"></div>
      <div className="auth-card glass">
        <header className="auth-header text-center">
          <div className="auth-icon-circle indigo"><UserPlus size={24} /></div>
          <h1 className="auth-title">Hesap Oluştur</h1>
          <p className="auth-subtitle">
            Bilimsel temelli eğitime katılmak için ilk adımı at. Bilgilerin tamamen anonim tutulur.
          </p>
        </header>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label htmlFor="email"><Mail size={16} /> E-posta</label>
            <input id="email" type="email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@eposta.com" />
          </div>
          <div className="input-group">
            <label htmlFor="password"><Lock size={16} /> Şifre</label>
            <input id="password" type="password" className="auth-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="input-group">
            <label htmlFor="passwordAgain"><ShieldCheck size={16} /> Şifre Tekrar</label>
            <input id="passwordAgain" type="password" className="auth-input" value={passwordAgain} onChange={(e) => setPasswordAgain(e.target.value)} placeholder="••••••••" />
          </div>
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Kaydediliyor..." : "Kayıt Ol ve Başla"}
          </button>
        </form>

        <p className="auth-footer">
          Zaten hesabın var mı? <Link href="/login">Giriş Yap</Link>
        </p>
      </div>
    </div>
  );
}