import { NextRequest, NextResponse } from "next/server";
import { ensureCsatSchema, insertCsatConversations, listCsatConversations, CsatConversation } from "@/lib/db";

function isAuthorized(req: NextRequest) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: { conversations: CsatConversation[] } = await req.json();

  if (!body || !Array.isArray(body.conversations) || body.conversations.length === 0) {
    return NextResponse.json(
      { error: "Expected a non-empty conversations array" },
      { status: 400 }
    );
  }

  await ensureCsatSchema();
  const result = await insertCsatConversations(body.conversations);

  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  await ensureCsatSchema();
  const { searchParams } = new URL(req.url);
  const rows = await listCsatConversations({
    sentiment: searchParams.get("sentiment") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  });
  return NextResponse.json({ conversations: rows });
}
