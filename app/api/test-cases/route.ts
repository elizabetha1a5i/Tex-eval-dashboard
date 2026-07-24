import { NextRequest, NextResponse } from "next/server";
import { ensureTestCaseSchema, listTestCases, upsertTestCase, TestCase } from "@/lib/db";

function isAuthorized(req: NextRequest) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  await ensureTestCaseSchema();
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const status = statusParam ? statusParam.split(",").map((s) => s.trim()) : undefined;
  const rows = await listTestCases({ status });
  return NextResponse.json({ test_cases: rows });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: Partial<TestCase> = await req.json();

  if (!body || !body.id || !body.title || !Array.isArray(body.conversation)) {
    return NextResponse.json(
      { error: "Expected a test case with at least id, title, and a conversation array" },
      { status: 400 }
    );
  }

  await ensureTestCaseSchema();
  const result = await upsertTestCase({ ...body, status: body.status ?? "draft" } as any, "api");

  return NextResponse.json(result);
}
