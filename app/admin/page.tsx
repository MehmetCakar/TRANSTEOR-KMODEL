// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";

type Opt = { text: string; isCorrect: boolean };
type Q = { text: string; options: Opt[] };

const NEW_VIDEO = "__new__";

export default function AdminPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");

  // video form state
  const [selectedVideoId, setSelectedVideoId] = useState<string>(NEW_VIDEO);
  const [order, setOrder] = useState<number>(1);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [durationSeconds, setDurationSeconds] = useState<number>(60);
  const [description, setDescription] = useState("");

  // survey state
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [videoSurveyMap, setVideoSurveyMap] = useState<Record<string, string>>({});

  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyType, setSurveyType] = useState<"VIDEO" | "FOLLOWUP">("VIDEO");
  const [surveyVideoId, setSurveyVideoId] = useState<string>("");

  const makeQuestion = (): Q => ({
    text: "",
    options: [
      { text: "", isCorrect: true }, // default: 1. şık doğru
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ],
  });

  const [questions, setQuestions] = useState<Q[]>([makeQuestion()]);

  function resetVideoFormForNew(list: any[]) {
    const maxOrder = list.reduce(
      (m: number, v: any) => Math.max(m, Number(v.order || 0)),
      0
    );
    setSelectedVideoId(NEW_VIDEO);
    setOrder(maxOrder + 1);
    setTitle("");
    setUrl("");
    setDurationSeconds(60);
    setDescription("");
  }

  function fillVideoForm(v: any) {
    setSelectedVideoId(v.id);
    setOrder(Number(v.order || 1));
    setTitle(v.title || "");
    setUrl(v.url || "");
    setDurationSeconds(Number(v.durationSeconds || 60));
    setDescription(v.description || "");
  }

  async function loadVideos() {
    const res = await fetch("/api/admin/videos");
    const json = await res.json();

    if (!res.ok) {
      setMsg(json.error || "Videolar alınamadı (admin misin?)");
      setVideos([]);
      return [];
    }

    const list = json.videos || [];
    setVideos(list);

    // ilk açılışta ya da DB reset sonrası: video yoksa -> new mod
    if (!list.length) {
      resetVideoFormForNew(list);
      if (!surveyVideoId) setSurveyVideoId("");
      return list;
    }

    // survey video default (ilk video)
    if (!surveyVideoId) setSurveyVideoId(list[0].id);

    // seçili video artık yoksa (DB reset vs) -> new mod
    if (selectedVideoId !== NEW_VIDEO && !list.some((v: any) => v.id === selectedVideoId)) {
      resetVideoFormForNew(list);
      return list;
    }

    // sayfa ilk açıldığında new modda kalsın, ama order’u max+1 yap
    if (selectedVideoId === NEW_VIDEO) {
      const maxOrder = list.reduce((m: number, v: any) => Math.max(m, Number(v.order || 0)), 0);
      setOrder(maxOrder + 1);
      return list;
    }

    // seçili videoyu tekrar forma bas (güncel olsun)
    const current = list.find((v: any) => v.id === selectedVideoId);
    if (current) fillVideoForm(current);

    return list;
  }

  async function loadVideoSurveyMap() {
    const res = await fetch("/api/admin/surveys");
    const json = await res.json();
    if (!res.ok) return {};

    const list = json?.surveys ?? [];
    const map: Record<string, string> = {};
    for (const s of list) {
      if (s.videoId) map[s.videoId] = s.id;
    }
    setVideoSurveyMap(map);
    return map;
  }

  async function loadSurveyForVideo(videoId: string) {
    // videoId boşsa (video yoksa) formu temizle
    if (!videoId) {
      setEditingSurveyId(null);
      setSurveyTitle("");
      setQuestions([makeQuestion()]);
      return;
    }

    const sid = videoSurveyMap[videoId];

    if (!sid) {
      // bu videoda survey yoksa, yeni oluşturma moduna dön
      setEditingSurveyId(null);
      setSurveyTitle("");
      setQuestions([makeQuestion()]);
      return;
    }

    const res = await fetch(`/api/admin/surveys/${sid}`);
    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Survey yüklenemedi");

    const s = json.survey;
    setEditingSurveyId(s.id);
    setSurveyTitle(s.title ?? "");
    setSurveyType(s.type);
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
      // admin değilse dashboard'a at
      const r = await fetch("/api/admin/videos");
      if (r.status === 401 || r.status === 403) {
        window.location.href = "/dashboard";
        return;
      }

      // normal yükleme
      const list = await loadVideos();
      const map = await loadVideoSurveyMap();

      // VIDEO modunda default olarak ilk video seçiliyse ve onun survey'i varsa yükle
      const defaultVideoId = (surveyVideoId || list?.[0]?.id) ?? "";
      if (defaultVideoId) {
        setSurveyVideoId(defaultVideoId);
        // map state'i async set ediliyor, burada local map ile karar verelim:
        const sid = map?.[defaultVideoId];
        if (sid) {
          // state'deki videoSurveyMap henüz set edilmeden de çağırabilmek için
          // geçici olarak loadSurveyForVideo çağıracağız ama o state'e bakıyor;
          // bu yüzden önce set edip sonra mikro-task
          setVideoSurveyMap(map);
          queueMicrotask(() => loadSurveyForVideo(defaultVideoId));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveVideo() {
    setMsg("");

    const payload = {
      order,
      title: title.trim(),
      url: url.trim(),
      durationSeconds,
      description: description ? String(description) : "",
    };

    if (!payload.title) return setMsg("Title zorunlu");
    if (!payload.url) return setMsg("Video URL zorunlu");
    if (!payload.durationSeconds || payload.durationSeconds <= 0) return setMsg("Duration Seconds zorunlu");

    const isNew = selectedVideoId === NEW_VIDEO;

    const res = await fetch(isNew ? "/api/admin/videos" : `/api/admin/videos/${selectedVideoId}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Video kaydedilemedi");

    setMsg(isNew ? "✅ Video eklendi" : "✅ Video güncellendi");

    const list = await loadVideos();

    // yeni eklendiyse otomatik seç
    if (isNew && json?.video?.id) {
      const created = list.find((v: any) => v.id === json.video.id);
      if (created) fillVideoForm(created);
      else setSelectedVideoId(json.video.id);
    }
  }

  async function saveSurvey() {
    setMsg("");

    if (!surveyTitle.trim()) return setMsg("Survey Title zorunlu");
    if (surveyType === "VIDEO" && !surveyVideoId) return setMsg("VIDEO survey için bölüm seçmelisin");

    // UI validasyon: her soru için en az 2 dolu şık + tam 1 doğru
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      const qText = q.text.trim();
      if (!qText) continue;

      const nonEmptyOptions = q.options.filter((o) => o.text.trim().length > 0);
      if (nonEmptyOptions.length < 2) {
        return setMsg(`Soru ${qi + 1}: En az 2 dolu şık girmen lazım`);
      }
      const correctCount = nonEmptyOptions.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        return setMsg(`Soru ${qi + 1}: Tam 1 doğru şık seçmelisin`);
      }
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

    const json = await res.json();
    if (!res.ok) return setMsg(json.error || "Survey eklenemedi");

    setMsg(editingSurveyId ? "✅ Survey güncellendi" : "✅ Survey eklendi");

    // map'i güncelle ve seçili videonun survey'ini tekrar yükle (sync olsun)
    await loadVideoSurveyMap();
    if (surveyType === "VIDEO" && surveyVideoId) {
      // yeni oluşturduysak id'yi endpoint dönüyor olabilir; ama map zaten yenilendi
      await loadSurveyForVideo(surveyVideoId);
    } else {
      // followup ise formu temizle
      setEditingSurveyId(null);
      setSurveyTitle("");
      setQuestions([makeQuestion()]);
    }
  }

  const sortedVideos = videos.slice().sort((a, b) => a.order - b.order);
  const videoSelectDisabled = sortedVideos.length === 0;

  return (
    <div className="app-shell">
      <main className="app-main">
        <section className="dashboard-card">
          <h1>Admin Panel</h1>
          {msg && <p style={{ marginTop: 8, color: "#b91c1c" }}>{msg}</p>}
        </section>

        <section className="dashboard-grid" style={{ marginTop: 16 }}>
          {/* VIDEO */}
          <article className="dashboard-card">
            <h2>Video Ekle</h2>

            <select
              value={selectedVideoId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedVideoId(id);

                if (id === NEW_VIDEO) {
                  resetVideoFormForNew(sortedVideos);
                  return;
                }

                const v = sortedVideos.find((x: any) => x.id === id);
                if (v) fillVideoForm(v);
              }}
            >
              <option value={NEW_VIDEO}>+ Yeni video ekle</option>
              {sortedVideos.map((v: any) => (
                <option key={v.id} value={v.id}>
                  Bölüm {v.order} - {v.title}
                </option>
              ))}
            </select>

            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <input value={order} onChange={(e) => setOrder(Number(e.target.value))} placeholder="Order" />
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Video URL" />
              <input
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                placeholder="Duration Seconds"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
              />

              <button className="dashboard-primary-btn" type="button" onClick={saveVideo}>
                {selectedVideoId === NEW_VIDEO ? "Video oluştur" : "Video güncelle"}
              </button>
            </div>
          </article>

          {/* SURVEY */}
          <article className="dashboard-card">
            <h2>Survey Ekle</h2>

            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <select
                value={surveyType}
                onChange={(e) => {
                  const t = e.target.value as any;
                  setSurveyType(t);

                  // FOLLOWUP seçilince video seçimini sıfırla
                  if (t === "FOLLOWUP") {
                    setSurveyVideoId("");
                    setEditingSurveyId(null);
                    setSurveyTitle("");
                    setQuestions([makeQuestion()]);
                  } else {
                    // VIDEO'ya dönünce ilk video varsa seç
                    if (!surveyVideoId && sortedVideos[0]?.id) setSurveyVideoId(sortedVideos[0].id);
                  }
                }}
              >
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
                  disabled={videoSelectDisabled}
                >
                  {videoSelectDisabled ? (
                    <option value="">Önce video eklemelisin</option>
                  ) : (
                    sortedVideos.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        Bölüm {v.order} - {v.title}
                      </option>
                    ))
                  )}
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