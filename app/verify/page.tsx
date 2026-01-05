"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, Mail, ArrowRight, RefreshCcw } from "lucide-react";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (res.ok) {
        router.push("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Doğrulama kodu hatalı.");
      }
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card glass animate-in fade-in duration-500">
      <header className="auth-header text-center">
        <div className="auth-icon-circle green"><ShieldCheck size={28} /></div>
        <h1 className="auth-title">E-posta Doğrulama</h1>
        <p className="auth-subtitle">
          <strong>{email}</strong> adresine gönderdiğimiz 6 haneli doğrulama kodunu aşağıya girin.
        </p>
      </header>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleVerify} className="auth-form">
        <div className="input-group">
          <label htmlFor="code">Doğrulama Kodu</label>
          <input
            id="code"
            type="text"
            maxLength={6}
            className="auth-input text-center tracking-[1em] font-bold text-xl"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        <button type="submit" className="auth-button" disabled={loading || code.length < 6}>
          {loading ? "Onaylanıyor..." : <><Mail size={18} /> Hesabı Onayla</>}
        </button>
      </form>

      <div className="auth-footer">
        <button className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-2 mx-auto bg-none border-none cursor-pointer">
          <RefreshCcw size={14} /> Kodu tekrar gönder
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="auth-page relative">
      <div className="blob blob-1"></div>
      <Suspense fallback={<div className="text-slate-500">Yükleniyor...</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}