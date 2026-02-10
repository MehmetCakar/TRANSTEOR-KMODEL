// app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { json } from "stream/consumers";

type Opt = { text: string; isCorrect: boolean };
type Q = { text: string; options: Opt[] };

function isYouTubeUrl(url?: string | null) {
  if (!url) return false;
  return url.includes("youtube.com") || url.includes("youtu.be");
}



function toYouTubeEmbed(input: string) {
  try {
    const url = new URL(input);

    // zaten embed
    if (url.hostname.includes("youtube.com") && url.pathname.startsWith("/embed/")) {
      return input;
    }

    // youtu.be/<id>
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (url.hostname.includes("youtube.com")) {
      // watch?v=<id>
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      const parts = url.pathname.split("/").filter(Boolean);

      // /embed/<id>
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return `https://www.youtube.com/embed/${parts[embedIdx + 1]}`;

      // /shorts/<id>
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return `https://www.youtube.com/embed/${parts[shortsIdx + 1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

export default function AdminPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");

  // video form state
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [order, setOrder] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number | "">("");
  const [description, setDescription] = useState("");

  // survey state
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [videoSurveyMap, setVideoSurveyMap] = useState<Record<string, string>>({});
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyType, setSurveyType] = useState<"VIDEO" | "FOLLOWUP">("VIDEO");
  const [surveyVideoId, setSurveyVideoId] = useState<string>("");
  const [followupSurveyId, setFollowupSurveyId] = useState<string | null>(null);

    // Yeni video mu?
  const NEW_ID = "__new__";
  const isNew = selectedVideoId === NEW_ID;

  // Ekranda gösterilecek bölüm no
  const displayOrder = isNew
    ? (videos.reduce((m, v) => Math.max(m, Number(v.order || 0)), 0) + 1)
    : (videos.find((v) => v.id === selectedVideoId)?.order ?? order);

  const makeQuestion = (): Q => ({
    text: "",
    options: [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  });
  const [questions, setQuestions] = useState<Q[]>([makeQuestion()]);

  const ytPreview = useMemo(() => {
    if (!url) return null;
    if (!isYouTubeUrl(url)) return null;
    return toYouTubeEmbed(url);
  }, [url]);  

  function resetSurveyForm(nextType?: "VIDEO" | "FOLLOWUP") {
    setEditingSurveyId(null);
    setSurveyTitle("");
    setQuestions([makeQuestion()]);

    const t = nextType ?? surveyType;

    if (t === "VIDEO") {
      const vid = surveyVideoId || videos?.[0]?.id || "";
      setSurveyVideoId(vid);
    } else {
      setSurveyVideoId(""); // FOLLOWUP'ta videoId yok
    }
  }

  async function loadVideos() {
    setMsg("");
    const res = await fetch("/api/admin/videos", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(json.error || "Videolar alınamadı (admin misin?)");
      return;
    }

    const list = json.videos || [];
    setVideos(list);

    // ilk açılışta: yeni video moduna geç
    if (!selectedVideoId) {
      setSelectedVideoId("__new__");
      const maxOrder = list.reduce((m: number, v: any) => Math.max(m, Number(v.order || 0)), 0);
      setOrder(maxOrder + 1);
      setTitle("");
      setUrl("");
      setDurationSeconds("");
      setDescription("");
      if (!surveyVideoId && list?.[0]?.id) setSurveyVideoId(list[0].id);
    }
  }

  async function loadVideoSurveyMap() {
    const res = await fetch("/api/admin/surveys", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return;

    const list = json?.surveys ?? [];

    const map: Record<string, string> = {};
    let followupId: string | null = null;

    for (const s of list) {
      if (s.type === "VIDEO" && s.videoId) {
        map[s.videoId] = s.id;
      }
      if (s.type === "FOLLOWUP") {
        // tek followup mantığı: en günceli gelsin (api zaten desc dönüyor)
        if (!followupId) followupId = s.id;
      }
    }

    setVideoSurveyMap(map);
    setFollowupSurveyId(followupId);
  }
  async function resolveYouTube() {
    const input = url?.trim();
    if (!input) return;

    setMsg("");
    try {
      const res = await fetch(`/api/admin/youtube/resolve?url=${encodeURIComponent(input)}`, {
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(json?.error || "Süre çekilemedi");
        return;
      }

      // duration
      if (typeof json.durationSeconds === "number") {
        setDurationSeconds(json.durationSeconds);
      }

      // URL'i embed'e çek (istersen DB'ye embed kaydediyorsun)
      if (json.embedUrl) {
        setUrl(String(json.embedUrl));
      }

      // Title sadece boşsa doldur
      if (!title.trim() && json.title) {
        setTitle(String(json.title));
      }

      setMsg("✅ YouTube süresi otomatik alındı");
    } catch (e: any) {
      setMsg(e?.message || "Süre çekilemedi");
    }
  }

  async function loadSurveyById(sid: string) {
    const res = await fetch(`/api/admin/surveys/${sid}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(json.error || "Survey yüklenemedi");

    const s = json.survey;
    setEditingSurveyId(s.id);
    setSurveyTitle(s.title ?? "");
    setSurveyType(s.type);
    setSurveyVideoId(s.videoId ?? ""); // followup ise boş kalır

    setQuestions(
      (s.questions ?? []).map((q: any) => ({
        text: q.text ?? "",
        options: (q.options ?? []).map((o: any) => ({
          text: o.text ?? "",
          isCorrect: !!o.isCorrect,
        })),
      }))
    );
  }

  async function loadSurveyForVideo(videoId: string) {
    const sid = videoSurveyMap[videoId];
    if (!sid) {
      setEditingSurveyId(null);
      setSurveyTitle("");
      setQuestions([makeQuestion()]);
      return;
    }

    const res = await fetch(`/api/admin/surveys/${sid}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(json.error || "Survey yüklenemedi");

    const s = json.survey;
    setEditingSurveyId(s.id);
    setSurveyTitle(s.title ?? "");
    setSurveyVideoId(s.videoId ?? "");

    setQuestions(
      (s.questions ?? []).map((q: any) => ({
        text: q.text ?? "",
        options: (q.options ?? []).map((o: any) => ({
          text: o.text ?? "",
          isCorrect: !!o.isCorrect,
        })),
      }))
    );

    setMsg("✏️ Survey yüklendi, düzenleyebilirsin");
  }

  useEffect(() => {
      (async () => {
        await loadVideos();
        await loadVideoSurveyMap();
      })();

      (async () => {
        const r = await fetch("/api/admin/videos");
        if (r.status === 401 || r.status === 403) window.location.href = "/dashboard";
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  useEffect(() => {
    // type değişince “eski survey soruları üstünde kalmasın”
    setEditingSurveyId(null);
    setSurveyTitle("");
    setQuestions([makeQuestion()]);

    if (surveyType === "VIDEO") {
      // VIDEO seçildiyse seçili videonun survey’ini yükle
      if (surveyVideoId) loadSurveyForVideo(surveyVideoId);
    } else {
      // FOLLOWUP seçildiyse mevcut followup survey varsa onu yükle
      if (followupSurveyId) loadSurveyById(followupSurveyId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyType]);

  useEffect(() => {
    if (surveyType !== "VIDEO") return;
    if (!surveyVideoId) return;
    loadSurveyForVideo(surveyVideoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyVideoId, surveyType]);

  async function saveVideo() {
    setMsg("");

    const payload = {
      title: title.trim(),
      url: url.trim(),
      durationSeconds: Number(durationSeconds || 0),
      description: description ? description : null,
    };

    if ( !payload.title || !payload.url || !payload.durationSeconds) {
      return setMsg("title, url, durationSeconds zorunlu");
    }

    // ✅ youtube link kabul, sadece ufak uyarı
    if (isYouTubeUrl(payload.url)) {
      const emb = toYouTubeEmbed(payload.url);
      if (!emb) return setMsg("YouTube linki geçersiz görünüyor (watch?v=... / youtu.be / embed / shorts)");
      payload.url = emb; // ✅ DB'ye embed kaydet
    }

    // Yeni video
    if (selectedVideoId === "__new__" || !selectedVideoId) {
      const res = await fetch("/api/admin/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setMsg(json.error || "Video eklenemedi");

      setMsg("✅ Video eklendi");
      await loadVideos();
      if (json?.video?.id) setSelectedVideoId(json.video.id);
      return;
    }

    // Var olanı güncelle
    const res = await fetch(`/api/admin/videos/${selectedVideoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(json.error || "Video güncellenemedi");

    setMsg("✅ Video güncellendi");
    await loadVideos();
  }

  async function saveSurvey() {
    setMsg("");
    if (!surveyTitle.trim()) return setMsg("Survey Title zorunlu");

    // UI validasyon
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      const qText = q.text.trim();
      if (!qText) continue;

      const nonEmptyOptions = q.options.filter((o) => o.text.trim().length > 0);
      if (nonEmptyOptions.length < 2) return setMsg(`Soru ${qi + 1}: En az 2 dolu şık girmen lazım`);
      const correctCount = nonEmptyOptions.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) return setMsg(`Soru ${qi + 1}: Tam 1 doğru şık seçmelisin`);
    }

    const cleanedQuestions = questions
      .map((q, qi) => ({
        order: qi + 1,
        text: q.text.trim(),
        options: q.options
          .map((o, oi) => ({
            order: oi + 1,
            text: o.text.trim(),
            isCorrect: !!o.isCorrect,
          }))
          .filter((o) => o.text.length > 0),
      }))
      .filter((q) => q.text.length > 0);

    const payload: any = {
      type: surveyType,
      title: surveyTitle.trim(),
      questions: cleanedQuestions,
    };
    if (surveyType === "VIDEO") payload.videoId = surveyVideoId;

    const endpoint = editingSurveyId ? `/api/admin/surveys/${editingSurveyId}` : `/api/admin/surveys`;
    const method = editingSurveyId ? "PUT" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(json.error || "Survey eklenemedi");

    setMsg("✅ Survey kaydedildi");

    // ✅ Map + followup id yenilensin
    await loadVideoSurveyMap();

    // ✅ Followup kaydettiysek: kaydettiğimiz survey’i edit moduna al
    // (json.survey.id API'den dönüyor olmalı; sende POST /api/admin/surveys ok:true,survey:... dönüyor)
    const savedId = json?.survey?.id;
    if (surveyType === "FOLLOWUP" && savedId) {
      await loadSurveyById(savedId);   // az önce verdiğim helper
    }

    // ✅ Video ise: o video için olan survey'i tekrar yükle (opsiyonel ama temiz)
    if (surveyType === "VIDEO" && surveyVideoId) {
      await loadSurveyForVideo(surveyVideoId);
    }
  }
 
  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="dashboard-card">
          <h1>Admin Panel</h1>
          {msg && <p style={{ marginTop: 8, color: "#b91c1c" }}>{msg}</p>}          
        </section>

        <div style={{ marginTop: 10, textAlign: "right" }}>
          <a href="/admin/reports" className="survey-link" style={{ fontSize: "0.9rem" }}>
            Raporlar ↗️
          </a>
        </div>

        <section className="dashboard-grid" style={{ marginTop: 16 }}>
          {/* VIDEO */}
          <article className="dashboard-card">
            <h2>Video Ekle / Düzenle</h2>

            <select
              value={selectedVideoId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedVideoId(id);

                if (id === "__new__") {
                  const maxOrder = videos.reduce((m, v) => Math.max(m, Number(v.order || 0)), 0);
                  setOrder(maxOrder + 1);
                  setTitle("");
                  setUrl("");
                  setDurationSeconds(60);
                  setDescription("");
                  return;
                }

                const v = videos.find((x) => x.id === id);
                if (!v) return;
                setOrder(v.order);
                setTitle(v.title || "");
                setUrl(v.url || "");
                setDurationSeconds(v.durationSeconds || 60);
                setDescription(v.description || "");
              }}
            >
              <option value="__new__">+ Yeni video ekle</option>
              {videos
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    Bölüm {v.order} - {v.title}
                  </option>
                ))}
            </select>

            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {/* ✅ order input yok */}
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                <b>Bölüm No:</b> {displayOrder} {isNew ? "(otomatik)" : ""}
              </div>

              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Video URL (YouTube watch / youtu.be / embed)"
              />
              <input
                value={durationSeconds}
                onChange={(e) => {
                  const v = e.target.value;
                  setDurationSeconds(v === "" ? "" : Number(v));
                }}
                placeholder="Duration Seconds"
              />
              <button type="button" className="dashboard-primary-btn" onClick={resolveYouTube}>
                YouTube Süresini Getir
              </button>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
              />
              {/* küçük preview */}
              {ytPreview && (
                <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)" }}>
                  <iframe
                    src={ytPreview}
                    title="preview"
                    style={{ width: "100%", aspectRatio: "16/9", border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              <button className="dashboard-primary-btn" type="button" onClick={saveVideo}>
                {isNew ? "Video Oluştur" : "Video Güncelle"}
              </button>
            </div>
          </article>

          {/* SURVEY */}
          <article className="dashboard-card">
            <h2>Survey Ekle / Güncelle</h2>

            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <select value={surveyType} onChange={(e) => setSurveyType(e.target.value as any)}>
                <option value="VIDEO">VIDEO (video sonu)</option>
                <option value="FOLLOWUP">FOLLOWUP (6 ay sonrası)</option>
              </select>

              <input value={surveyTitle} onChange={(e) => setSurveyTitle(e.target.value)} placeholder="Survey Title" />

              {surveyType === "VIDEO" && (
                <select
                  value={surveyVideoId}
                  onChange={(e) => {
                    const vid = e.target.value;
                    setSurveyVideoId(vid);
                    loadSurveyForVideo(vid);
                  }}
                >
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      Bölüm {v.order} - {v.title}
                    </option>
                  ))}
                </select>
              )}

              {questions.map((q, qi) => (
                <div key={qi} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <b>Soru {qi + 1}</b>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                        style={{ marginLeft: "auto" }}
                      >
                        Sil
                      </button>
                    )}
                  </div>

                  <input
                    value={q.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, text: val } : x)));
                    }}
                    placeholder="Soru metni"
                    style={{ marginTop: 8 }}
                  />

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {q.options.map((o, oi) => (
                      <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 90 }}>
                          <input
                            type="radio"
                            name={`correct-${qi}`}
                            checked={o.isCorrect}
                            onChange={() => {
                              setQuestions((prev) =>
                                prev.map((x, i) => {
                                  if (i !== qi) return x;
                                  return {
                                    ...x,
                                    options: x.options.map((op, j) => ({ ...op, isCorrect: j === oi })),
                                  };
                                })
                              );
                            }}
                          />
                          <span style={{ fontSize: 13 }}>Doğru</span>
                        </label>

                        <input
                          value={o.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestions((prev) =>
                              prev.map((x, i) => {
                                if (i !== qi) return x;
                                return {
                                  ...x,
                                  options: x.options.map((op, j) => (j === oi ? { ...op, text: val } : op)),
                                };
                              })
                            );
                          }}
                          placeholder={`Şık ${oi + 1}`}
                          style={{ flex: 1 }}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                    {q.options.length < 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuestions((prev) =>
                            prev.map((x, i) =>
                              i === qi ? { ...x, options: [...x.options, { text: "", isCorrect: false }] } : x
                            )
                          );
                        }}
                      >
                        + Şık ekle
                      </button>
                    )}
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuestions((prev) =>
                            prev.map((x, i) => {
                              if (i !== qi) return x;
                              const next = x.options.slice(0, -1);
                              const hasCorrect = next.some((n) => n.isCorrect);
                              return {
                                ...x,
                                options: hasCorrect ? next : next.map((n, k) => ({ ...n, isCorrect: k === 0 })),
                              };
                            })
                          );
                        }}
                      >
                        - Şık sil
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button type="button" onClick={() => setQuestions((prev) => [...prev, makeQuestion()])}>
                + Soru Ekle
              </button>

              <button className="dashboard-primary-btn" type="button" onClick={saveSurvey}>
                {editingSurveyId ? "Survey Güncelle" : "Survey Oluştur"}
              </button>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}