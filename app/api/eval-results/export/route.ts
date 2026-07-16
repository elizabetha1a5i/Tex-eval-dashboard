import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, listRuns } from "@/lib/db";

const COLUMNS = [
  "id", "run_date", "test_id", "name", "category", "environment",
  "status", "score", "alignment_score", "penalty_points", "importance",
  "summary", "notes", "response_time", "message_count", "screenshot_path",
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 1000,
  });

  const lines = [COLUMNS.join(",")];
  for (const r of rows as any[]) {
    lines.push(COLUMNS.map((c) => csvEscape(r[c])).join(","));
  }

  const csv = lines.join("\n");
  const filename = `tex-eval-results-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
