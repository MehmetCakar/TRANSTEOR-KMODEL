// app/surveys/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Option = { id: string; text: string; order?: number };
type Question = { id: string; text: string; order: number; options: Option[] };

type SurveyDTO = {
  id: string;
  title: string;
  questions: (Question & { correctOptionId?: string | null })[];
};

type ApiGetSurvey = {
  ok: boolean;
  survey?: SurveyDTO;
  alreadyFilled?: boolean;
  myAnswers?: { questionId: string; optionId: string }[];
  result?: { total: number; correct: number; wrong: number; scorePct: number } | null;
  error?: string;
};

type SubmitResult = {
  ok: boolean;
  result?: { total: number; correct: number; wrong: number; scorePct: number };
  error?: string;
};

export default function SurveyPage() {
  const router = useRouter();

  // ✅ [id] -> params.id
  const params = useParams<{ id: string }>();
  const surveyId = params?.id;

  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState<SurveyDTO | null>(null);

  // already filled state
  const [alreadyFilled, setAlreadyFilled] = useState(false);
  const [myAnswers, setMyAnswers] = useState<Record<string, string>>({});
  const [prefilledResult, setPrefilledResult] = useState<ApiGetSurvey["result"]>(null);

  // question index
  const [step, setStep] = useState(0);

  // answers (for new submission)
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // inline validation message (same card)
  const [inlineError, setInlineError] = useState<string>("");

  // submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!surveyId) {
      setInlineError("Survey id bulunamadı (URL hatalı olabilir).");
      setLoading(false);
      return;
    }

    (async () => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);

      try {
        setLoading(true);

        // ✅ API: /api/surveys/[surveyId] ama sayfa paramı id -> burada id'yi gönderiyoruz
        const res = await fetch(`/api/surveys/${surveyId}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const json: ApiGetSurvey = await res.json().catch(() => ({ ok: false, error: "json parse error" }));

        if (!res.ok || !json?.ok || !json?.survey) {
          setSurvey(null);
          setInlineError(json?.error || `Survey yüklenemedi (status ${res.status}).`);
          return;
        }

        const s = json.survey;
        const qs = (s.questions ?? [])
          .slice()
          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

        setSurvey({ ...s, questions: qs });

        // ✅ “Cevapları gör” senaryosu: API alreadyFilled true dönebilir
        const filled = !!json.alreadyFilled;
        setAlreadyFilled(filled);

        const my = Array.isArray(json.myAnswers) ? json.myAnswers : [];
        const map: Record<string, string> = {};
        for (const a of my) map[a.questionId] = a.optionId;
        setMyAnswers(map);

        setPrefilledResult(json.result ?? null);

        // yeni doldurma modunda state reset
        setStep(0);
        setAnswers({});
        setInlineError("");
        setSubmitResult(null);
      } catch (e: any) {
        setSurvey(null);
        if (e?.name === "AbortError") setInlineError("Survey yüklenemedi (timeout).");
        else setInlineError(e?.message || "Survey yüklenemedi.");
      } finally {
        clearTimeout(t);
        setLoading(false);
      }
    })();
  }, [surveyId]);

  const questions = survey?.questions ?? [];
  const total = questions.length;
  const q = questions[step] ?? null;

  const progressPct = useMemo(() => {
    if (!total) return 0;
    const base = (step / total) * 100;
    const min = 6;
    return Math.min(100, Math.max(min, Math.round(base)));
  }, [step, total]);

  const answeredCount = useMemo(() => {
    const src = alreadyFilled ? myAnswers : answers;
    return questions.reduce((acc, qq) => acc + (src[qq.id] ? 1 : 0), 0);
  }, [alreadyFilled, answers, myAnswers, questions]);

  function selectOption(questionId: string, optionId: string) {
    if (alreadyFilled) return; // ✅ cevapları gör modunda seçim yok
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    setInlineError("");
  }

  function requireAnswerOrWarn(): boolean {
    if (!q) return false;

    const src = alreadyFilled ? myAnswers : answers;
    if (src[q.id]) return true;

    setInlineError("Devam etmek için bir şık seçmelisin.");
    setShake(true);
    window.setTimeout(() => setShake(false), 350);
    return false;
  }

  function goNext() {
    if (!requireAnswerOrWarn()) return;
    setInlineError("");
    setStep((s) => Math.min(total - 1, s + 1));
  }

  function goPrev() {
    setInlineError("");
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    if (!requireAnswerOrWarn()) return;
    if (!surveyId) return;

    setSubmitting(true);
    setInlineError("");

    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })),
      };

      // ✅ submit route param adı da surveyId olmalı (route.ts içinde)
      const res = await fetch(`/api/surveys/${surveyId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitResult({ ok: false, error: json?.error || "Gönderim başarısız." });
        return;
      }

      setSubmitResult(json);
    } catch (e: any) {
      setSubmitResult({ ok: false, error: e?.message || "Gönderim başarısız." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <div className="app-main">
          <div className="dashboard-card">Yükleniyor...</div>
        </div>
        <Style />
      </div>
    );
  }

  // ✅ Cevapları gör modunda sonuç varsa direkt göster
  if (alreadyFilled && prefilledResult) {
    const r = prefilledResult;
    return (
      <div className="app-shell">
        <div className="app-main">
          <div className="survey-header-card">
            <div className="survey-header-left">
              <h1 className="survey-title">{survey?.title || "Anket Sonucu"}</h1>
              <p className="survey-subtitle">Cevapların ve sonuçların</p>
            </div>
            <button className="link-btn" type="button" onClick={() => router.push("/dashboard")}>
              ← Dashboard’a dön
            </button>
          </div>

          <div className="dashboard-card survey-card">
            <h2 className="result-title">✅ Daha önce tamamladın</h2>

            <div className="result-grid">
              <div className="result-box">
                <div className="result-label">Skor</div>
                <div className="result-value">{r.scorePct}%</div>
              </div>
              <div className="result-box">
                <div className="result-label">Doğru</div>
                <div className="result-value">{r.correct}</div>
              </div>
              <div className="result-box">
                <div className="result-label">Yanlış</div>
                <div className="result-value">{r.wrong}</div>
              </div>
              <div className="result-box">
                <div className="result-label">Toplam</div>
                <div className="result-value">{r.total}</div>
              </div>
            </div>

            <div className="btn-row-center" style={{ marginTop: 20 }}>
              <button className="primary-btn" type="button" onClick={() => router.push("/surveys")}>
                Tüm anketlere dön
              </button>
            </div>
          </div>
        </div>
        <Style />
      </div>
    );
  }

  // Result ekranı (yeni submit sonrası)
  if (submitResult?.ok && submitResult.result) {
    const r = submitResult.result;
    return (
      <div className="app-shell">
        <div className="app-main">
          <div className="survey-header-card">
            <div className="survey-header-left">
              <h1 className="survey-title">{survey?.title || "Anket Sonucu"}</h1>
              <p className="survey-subtitle">Sonuçlar</p>
            </div>
            <button className="link-btn" type="button" onClick={() => router.push("/dashboard")}>
              ← Dashboard’a dön
            </button>
          </div>

          <div className="dashboard-card survey-card">
            <h2 className="result-title">🎉 Tamamlandı</h2>

            <div className="result-grid">
              <div className="result-box">
                <div className="result-label">Skor</div>
                <div className="result-value">{r.scorePct}%</div>
              </div>
              <div className="result-box">
                <div className="result-label">Doğru</div>
                <div className="result-value">{r.correct}</div>
              </div>
              <div className="result-box">
                <div className="result-label">Yanlış</div>
                <div className="result-value">{r.wrong}</div>
              </div>
              <div className="result-box">
                <div className="result-label">Toplam</div>
                <div className="result-value">{r.total}</div>
              </div>
            </div>

            <div className="btn-row-center" style={{ marginTop: 20 }}>
              <button className="primary-btn" type="button" onClick={() => router.push("/dashboard")}>
                Dashboard’a dön
              </button>
            </div>
          </div>
        </div>
        <Style />
      </div>
    );
  }

  // Survey load error
  if (!survey || total === 0 || !q) {
    return (
      <div className="app-shell">
        <div className="app-main">
          <div className="survey-header-card">
            <div className="survey-header-left">
              <h1 className="survey-title">Anket</h1>
              <p className="survey-subtitle">Yüklenemedi</p>
            </div>
            <button className="link-btn" type="button" onClick={() => router.push("/dashboard")}>
              ← Dashboard’a dönlink
            </button>
          </div>

          <div className="dashboard-card survey-card">
            <h2 style={{ margin: 0 }}>Bir hata oluştu</h2>
            <p className="inline-error" style={{ marginTop: 10 }}>
              {inlineError || "Survey bulunamadı."}
            </p>
          </div>
        </div>
        <Style />
      </div>
    );
  }

  const selectedOptionId = answers[q.id] || "";

  return (
    <div className="app-shell">
      <div className="app-main">
        <div className="survey-header-card">
          <div className="survey-header-left">
            <h1 className="survey-title">{survey.title}</h1>
            <p className="survey-subtitle">
              Soru {step + 1} / {total} • {answeredCount}/{total} cevaplandı
            </p>

            <div className="progress-wrap" aria-label="progress">
              <div className="progress-bar" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <button className="link-btn" type="button" onClick={() => router.push("/dashboard")}>
            ← Dashboard’a dön
          </button>
        </div>

        <div className={`dashboard-card survey-card ${shake ? "shake" : ""}`}>
          <div className="question-title">
            <span className="q-badge">{step + 1}</span>
            <h2 style={{ margin: 0 }}>{q.text}</h2>
          </div>

          <div className="options">
            {q.options.map((o, idx) => {
              const selected = selectedOptionId === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`option-btn ${selected ? "selected" : ""}`}
                  onClick={() => selectOption(q.id, o.id)}
                >
                  <span className={`opt-dot ${selected ? "on" : ""}`} />
                  <span className="opt-text">
                    <b style={{ marginRight: 8 }}>{idx + 1}.</b> {o.text}
                  </span>
                </button>
              );
            })}
          </div>

          {inlineError && <div className="inline-error">{inlineError}</div>}

          <div className="btn-row-center">
            <button
              type="button"
              onClick={goPrev}
              disabled={step === 0 || submitting}
              className="primary-btn"
              style={{ opacity: step === 0 ? 0.55 : 1 }}
            >
              ← Geri
            </button>

            {step < total - 1 ? (
              <button type="button" onClick={goNext} disabled={submitting} className="primary-btn">
                İleri →
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} className="primary-btn">
                {submitting ? "Gönderiliyor..." : "Anketi Gönder"}
              </button>
            )}
          </div>

          {submitResult?.ok === false && submitResult.error && (
            <div className="inline-error" style={{ marginTop: 12 }}>
              {submitResult.error}
            </div>
          )}
        </div>
      </div>
      <Style />
    </div>
  );
}

function Style() {
  return (
    <style jsx global>{`
      .survey-header-card {
        border-radius: 22px;
        padding: 18px 18px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(15, 23, 42, 0.08);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }
      .survey-header-left {
        flex: 1;
        min-width: 0;
      }
      .survey-title {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
      }
      .survey-subtitle {
        margin: 6px 0 10px 0;
        font-size: 13px;
        color: rgba(15, 23, 42, 0.65);
      }
      .link-btn {
        background: transparent;
        border: none;
        color: #4f46e5;
        cursor: pointer;
        font-weight: 700;
        padding: 6px 8px;
        border-radius: 10px;
      }
      .link-btn:hover {
        background: rgba(79, 70, 229, 0.08);
      }
      .progress-wrap {
        height: 10px;
        width: 100%;
        background: rgba(15, 23, 42, 0.08);
        border-radius: 999px;
        overflow: hidden;
      }
      .progress-bar {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #6366f1, #22d3ee);
        transition: width 220ms ease;
      }
      .survey-card {
        padding: 20px;
        border-radius: 22px;
      }
      .question-title {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      .q-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: rgba(99, 102, 241, 0.12);
        color: #4f46e5;
        font-weight: 800;
      }
      .options {
        display: grid;
        gap: 10px;
        margin-top: 10px;
      }
      .option-btn {
        text-align: left;
        border: 1px solid rgba(15, 23, 42, 0.1);
        background: rgba(255, 255, 255, 0.9);
        padding: 12px 12px;
        border-radius: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      }
      .option-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        border-color: rgba(79, 70, 229, 0.35);
      }
      .option-btn.selected {
        border-color: rgba(79, 70, 229, 0.6);
        box-shadow: 0 10px 26px rgba(79, 70, 229, 0.12);
        background: rgba(99, 102, 241, 0.08);
      }
      .opt-dot {
        width: 14px;
        height: 14px;
        border-radius: 999px;
        border: 2px solid rgba(15, 23, 42, 0.25);
        display: inline-block;
        flex: 0 0 auto;
      }
      .opt-dot.on {
        border-color: rgba(79, 70, 229, 0.8);
        background: rgba(79, 70, 229, 0.8);
      }
      .opt-text {
        color: #0f172a;
        font-size: 14px;
        line-height: 1.3;
      }
      .inline-error {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.25);
        color: #b91c1c;
        font-weight: 600;
        font-size: 13px;
      }
      .btn-row-center {
        margin-top: 18px;
        display: flex;
        justify-content: center;
        gap: 18px;
      }
      .primary-btn {
        min-width: 180px;
        padding: 12px 18px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(90deg, #6366f1, #22d3ee);
        color: #fff;
        font-weight: 800;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
      }
      .primary-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 14px 26px rgba(34, 211, 238, 0.18);
      }
      .primary-btn:disabled {
        cursor: not-allowed;
        opacity: 0.6;
        transform: none;
        box-shadow: none;
      }
      .shake {
        animation: shake 320ms ease;
      }
      @keyframes shake {
        0% { transform: translateX(0); }
        25% { transform: translateX(-6px); }
        50% { transform: translateX(6px); }
        75% { transform: translateX(-4px); }
        100% { transform: translateX(0); }
      }
      .result-title {
        margin: 0;
        font-size: 18px;
        font-weight: 900;
        color: #0f172a;
      }
      .result-grid {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .result-box {
        border-radius: 16px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(15, 23, 42, 0.08);
      }
      .result-label {
        font-size: 12px;
        color: rgba(15, 23, 42, 0.6);
        font-weight: 700;
      }
      .result-value {
        margin-top: 6px;
        font-size: 20px;
        font-weight: 900;
        color: #0f172a;
      }
      @media (max-width: 520px) {
        .btn-row-center {
          flex-direction: column;
          gap: 12px;
          align-items: stretch;
        }
        .primary-btn {
          width: 100%;
          min-width: unset;
        }
        .result-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}