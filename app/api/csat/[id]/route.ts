import { NextRequest, NextResponse } from "next/server";
import { ensureCsatSchema, updateCsatConversation, deleteCsatConversation } from "@/lib/db";

function isAuthorized(req: NextRequest) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { notes, reviewed, csat_score, sentiment, qa_status, resolved } = body ?? {};

  if (
    notes === undefined &&
    reviewed === undefined &&
    csat_score === undefined &&
    sentiment === undefined &&
    qa_status === undefined &&
    resolved === undefined
  ) {
    return NextResponse.json(
      { error: "Provide at least one of: notes, reviewed, csat_score, sentiment, qa_status, resolved" },
      { status: 400 }
    );
  }

  await ensureCsatSchema();
  await updateCsatConversation(params.id, { notes, reviewed, csat_score, sentiment, qa_status, resolved });

  return NextResponse.json({ updated: params.id });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureCsatSchema();
  await deleteCsatConversation(params.id);

  return NextResponse.json({ deleted: params.id });
}
