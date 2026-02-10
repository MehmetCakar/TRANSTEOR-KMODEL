// app/api/surveys/[surveyId]/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJWT } from "@/lib/jwt";

async function getUserFromToken(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token) return { user: null, error: NextResponse.json({ error: "no auth" }, { status: 401 }) };

  let claim: string;
  try {
    claim = String(parseJWT(token)).trim();
  } catch {
    return { user: null, error: NextResponse.json({ error: "invalid token" }, { status: 401 }) };
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ id: claim }, { email: claim.toLowerCase() }] },
  });

  if (!user) return { user: null, error: NextResponse.json({ error: "user not found" }, { status: 404 }) };
  return { user, error: null };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = await params;

  const { user, error } = await getUserFromToken(req);
  if (error) return error;

  const body = await req.json().catch(() => null);
  const answers: { questionId: string; optionId: string }[] = Array.isArray(body?.answers) ? body.answers : [];

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: { include: { options: true }, orderBy: { order: "asc" } },
    },
  });
  if (!survey || !survey.isActive) return NextResponse.json({ error: "survey not found" }, { status: 404 });

  const correctByQuestion = new Map<string, string>();
  for (const q of survey.questions) {
    const correct = q.options.find((o) => o.isCorrect);
    if (correct) correctByQuestion.set(q.id, correct.id);
  }

  let correctCount = 0;
  const total = survey.questions.length;

  for (const q of survey.questions) {
    const a = answers.find((x) => x.questionId === q.id);
    if (!a) continue;
    if (correctByQuestion.get(q.id) === a.optionId) correctCount++;
  }

  await prisma.surveyResponse.upsert({
    where: { userId_surveyId: { userId: user!.id, surveyId: survey.id } },
    update: { answers },
    create: { userId: user!.id, surveyId: survey.id, answers },
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