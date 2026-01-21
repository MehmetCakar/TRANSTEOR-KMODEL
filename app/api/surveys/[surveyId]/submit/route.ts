import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/jwt";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return NextResponse.json({ error: "no auth" }, { status: 401 });

  let email = "";
  try { email = parseJWT(token); } catch { return NextResponse.json({ error: "invalid token" }, { status: 401 }); }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const answers: { questionId: string; optionId: string }[] = Array.isArray(body?.answers) ? body.answers : [];

  const survey = await prisma.survey.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        include: { options: true },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!survey) return NextResponse.json({ error: "survey not found" }, { status: 404 });

  // doğruları map'le
  const correctByQuestion = new Map<string, string>();
  for (const q of survey.questions) {
    const correct = q.options.find(o => o.isCorrect);
    if (correct) correctByQuestion.set(q.id, correct.id);
  }

  let correctCount = 0;
  const total = survey.questions.length;

  for (const q of survey.questions) {
    const a = answers.find(x => x.questionId === q.id);
    if (!a) continue;
    if (correctByQuestion.get(q.id) === a.optionId) correctCount++;
  }

  // DB'ye kaydet (answers Json)
  await prisma.surveyResponse.upsert({
    where: { userId_surveyId: { userId: user.id, surveyId: survey.id } },
    update: { answers },
    create: { userId: user.id, surveyId: survey.id, answers },
  });

  return NextResponse.json({
    ok: true,
    result: {
      total,
      correct: correctCount,
      wrong: total - correctCount,
      scorePct: total ? Math.round((correctCount / total) * 100) : 0,
    },
  });
}