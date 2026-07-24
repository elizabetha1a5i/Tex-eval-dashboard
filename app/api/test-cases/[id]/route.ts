import { NextRequest, NextResponse } from "next/server";
import { ensureTestCaseSchema, upsertTestCase, TestCase } from "@/lib/db";

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

  const body: Partial<TestCase> = await req.json();

  await ensureTestCaseSchema();
  const result = await upsertTestCase({ ...body, id: params.id } as any, "reviewer (qa-review UI)");

  return NextResponse.json(result);
}
