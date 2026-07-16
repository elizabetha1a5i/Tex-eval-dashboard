import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, updateRun } from "@/lib/db";

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
  const { status, notes } = body ?? {};

  if (status === undefined && notes === undefined) {
    return NextResponse.json(
      { error: "Provide at least one of: status, notes" },
      { status: 400 }
    );
  }

  await ensureSchema();
  await updateRun(params.id, { status, notes });

  return NextResponse.json({ updated: params.id });
}
