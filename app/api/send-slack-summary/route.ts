import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, listRuns } from "@/lib/db";

function isAuthorized(req: NextRequest) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

function normStatus(s: string) {
  return (s || "").toUpperCase();
}

export async function POST(req: NextRequest) {
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

  const { searchParams, origin } = new URL(req.url);

  await ensureSchema();
  const runs = await listRuns({
    environment: searchParams.get("environment") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    limit: 1000,
  });

  const total = runs.length;
  if (total === 0) {
    return NextResponse.json({ error: "No results to summarize" }, { status: 400 });
  }

  const passCount = runs.filter((r: any) => normStatus(r.status) === "PASS").length;
  const passRate = Math.round((passCount / total) * 100);
  const publishedRuns = new Set(runs.map((r: any) => new Date(r.run_date).toISOString().slice(0, 10))).size;
  const environment = searchParams.get("environment") || runs[0]?.environment || "production";

  const headerEmoji = passRate >= 90 ? "✅" : passRate >= 70 ? "⚠️" : "❌";

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `${headerEmoji} Tex QA Results — ${environment}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Pass Rate*\n${passRate}%` },
        { type: "mrkdwn", text: `*Tests Run*\n${total}` },
        { type: "mrkdwn", text: `*Passing*\n${passCount} of ${total}` },
        { type: "mrkdwn", text: `*Run*\n${publishedRuns} published run${publishedRuns === 1 ? "" : "s"}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `📊 <${origin}|View Dashboard>` },
    },
  ];

  const slackRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!slackRes.ok) {
    const text = await slackRes.text();
    return NextResponse.json({ error: `Slack rejected the message: ${text}` }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}
