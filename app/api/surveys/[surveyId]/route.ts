// app/api/surveys/[surveyId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  const { surveyId } = await params;

  if (!surveyId) {
    return NextResponse.json({ error: "surveyId missing" }, { status: 400 });
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: {
            orderBy: { order: "asc" },
            select: { id: true, order: true, text: true },
          },
        },
      },
    },
  });

  if (!survey) {
    return NextResponse.json({ error: "survey not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, survey });
}