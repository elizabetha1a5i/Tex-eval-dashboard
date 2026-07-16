import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getRunById } from "@/lib/db";

function isAuthorized(req: NextRequest) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

function statusEmoji(status: string) {
  const s = (status || "").toUpperCase();
  if (s === "PASS") return "✅";
  if (s === "WARN") return "⚠️";
  if (s === "FAIL") return "❌";
  return "❓";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "SLACK_WEBHOOK_URL is not configured on the dashboard" },
      { status: 500 }
    );
  }

  await ensureSchema();
  const run = await getRunById(params.id);
  if (!run) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  const lines = [
    `${statusEmoji(run.status)} *${run.name}* — ${run.status}`,
    `Category: ${run.category} · Environment: ${run.environment} · Score: ${run.score ?? "-"}`,
    run.summary ? `> ${run.summary}` : null,
    run.notes ? `_Reviewer notes: ${run.notes}_` : null,
    run.screenshot_path ? `Screenshot: ${run.screenshot_path}` : null,
  ].filter(Boolean);

  const slackRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: lines.join("\n") }),
  });

  if (!slackRes.ok) {
    const text = await slackRes.text();
    return NextResponse.json({ error: `Slack rejected the message: ${text}` }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
