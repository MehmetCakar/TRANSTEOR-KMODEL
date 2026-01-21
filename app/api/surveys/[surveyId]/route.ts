// app/api/surveys/[surveyId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const survey = await prisma.survey.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" }, select: { id: true, order: true, text: true } } },
      },
    },
  });

  if (!survey || !survey.isActive) {
    return NextResponse.json({ error: "survey not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, survey });
}