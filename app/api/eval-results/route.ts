import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, insertResults, listRuns, EvalResult } from "@/lib/db";

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

  const body = await req.json();
  const results: EvalResult[] = Array.isArray(body) ? body : body.results;

  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: "Expected a non-empty results array" }, { status: 400 });
  }

  await ensureSchema();
  await insertResults(results);

  return NextResponse.json({ inserted: results.length });
}

export async function GET(req: NextRequest) {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const rows = await listRuns({
    environment: searchParams.get("environment") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
  });
  return NextResponse.json({ runs: rows });
}
