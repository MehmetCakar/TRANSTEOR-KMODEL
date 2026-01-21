// app/api/admin/surveys/[id]/questions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireAdmin(req);
  if (!r.ok) return r.status;

  const { id: surveyId } = await params;
  const body = await req.json().catch(() => ({}));

  const order = Number(body.order);
  const text = String(body.text || "").trim();
  if (!order || !text) {
    return NextResponse.json({ error: "order/text zorunlu" }, { status: 400 });
  }

  const q = await prisma.surveyQuestion.create({
    data: { surveyId, order, text },
  });

  return NextResponse.json({ ok: true, question: q });
}