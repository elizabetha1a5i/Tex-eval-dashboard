import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: "INGEST_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const key = body?.key ?? "";

  if (key !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
