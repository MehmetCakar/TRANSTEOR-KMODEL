// app/surveys/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Option = {
  id: string;
  order: number;
  text: string;
};

type Question = {
  id: string;
  order: number;
  text: string;
  options: Option[];
};

export default function SurveyPage() {
  const params = useParams<{ id: string }>();
  const surveyId = params?.id;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!surveyId) return;

    fetch(`/api/surveys/${surveyId}`)
      .then((r) => r.json())
      .then((json) => {
        setQuestions(json.survey.questions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [surveyId]);

  function selectOption(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  async function submitSurvey() {
    if (!surveyId) return;

    const payload = {
      answers: Object.entries(answers).map(([questionId, optionId]) => ({
        questionId,
        optionId,
      })),
    };

    const res = await fetch(`/api/surveys/${surveyId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    setResult(json.result);
  }

  if (loading) return <p>Yükleniyor...</p>;

  if (result) {
    return (
      <div style={{ maxWidth: 600, margin: "40px auto" }}>
        <h2>Sonuç</h2>
        <p>Toplam soru: {result.total}</p>
        <p>Doğru: {result.correct}</p>
        <p>Yanlış: {result.wrong}</p>
        <p>Başarı: %{result.scorePct}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto" }}>
      <h1>Anket</h1>

      {questions.map((q) => (
        <div key={q.id} style={{ marginBottom: 24 }}>
          <strong>
            {q.order}) {q.text}
          </strong>

          {q.options.map((o) => (
            <label key={o.id} style={{ display: "block", marginTop: 6 }}>
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === o.id}
                onChange={() => selectOption(q.id, o.id)}
              />
              {"  "}
              {o.text}
            </label>
          ))}
        </div>
      ))}

      <button onClick={submitSurvey}>Anketi Gönder</button>
    </div>
  );
}