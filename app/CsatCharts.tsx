import type { CSSProperties } from "react";

type Conversation = {
  occurred_at: string | null;
  csat_score: number | null;
  sentiment: string | null;
  resolved: boolean | null;
  qa_status?: string | null;
  no_reply?: boolean | null;
  imported_at?: string | null;
  source_file?: string | null;
};

function parseDateRangeFromSourceFile(sourceFile: string | null | undefined): string | null {
  if (!sourceFile) return null;
  const match = sourceFile.match(/(\d{4}-\d{2}-\d{2})-to-(\d{4}-\d{2}-\d{2})/);
  if (match) return `${match[1]} → ${match[2]}`;
  return sourceFile; // e.g. a CSV filename — show as-is
}

const SENTIMENT_STYLE: Record<string, { fg: string; bg: string; label: string }> = {
  positive: { fg: "#137333", bg: "#e6f4ea", label: "Positive" },
  neutral: { fg: "#7a5200", bg: "#fef9e7", label: "Neutral" },
  negative: { fg: "#b91c1c", bg: "#fef2f2", label: "Negative" },
};
const SENTIMENT_ORDER = ["positive", "neutral", "negative"] as const;

function normSentiment(s: string | null) {
  const k = (s || "").toLowerCase();
  return k in SENTIMENT_STYLE ? k : "neutral";
}

const cardStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  padding: "16px 20px",
};

const cardTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#5a6478",
  marginBottom: 12,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

// ── Stat tiles ──────────────────────────────────────────────────────────────

export function CsatStatTiles({ conversations }: { conversations: Conversation[] }) {
  const total = conversations.length;
  const scored = conversations.filter((c) => typeof c.csat_score === "number");
  const avgScore = scored.length
    ? Math.round((scored.reduce((sum, c) => sum + (c.csat_score ?? 0), 0) / scored.length) * 10) / 10
    : 0;
  const negativeCount = conversations.filter((c) => normSentiment(c.sentiment) === "negative").length;
  const negativePct = total > 0 ? Math.round((negativeCount / total) * 100) : 0;
  const resolvedCount = conversations.filter((c) => c.resolved === true).length;
  const resolvedPct = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;
  const noReplyCount = conversations.filter((c) => c.no_reply === true).length;

  const mostRecentlyImported = conversations.reduce((latest, c) => {
    if (!c.imported_at) return latest;
    if (!latest || !latest.imported_at) return c;
    return new Date(c.imported_at) > new Date(latest.imported_at) ? c : latest;
  }, null as Conversation | null);
  const lastRunLabel = mostRecentlyImported?.imported_at
    ? new Date(mostRecentlyImported.imported_at).toLocaleString()
    : "-";
  const lastRunRange = parseDateRangeFromSourceFile(mostRecentlyImported?.source_file) ?? "no runs yet";

  const tiles = [
    { label: "Avg CSAT Score", value: total ? `${avgScore}/5` : "-", sub: `${scored.length} scored`, critical: false },
    { label: "Conversations Analyzed", value: String(total), sub: "from Community.com exports", critical: false },
    { label: "Negative Sentiment", value: `${negativePct}%`, sub: `${negativeCount} conversations`, critical: false },
    { label: "Resolution Rate", value: `${resolvedPct}%`, sub: `${resolvedCount} of ${total}`, critical: false },
    {
      label: "No Reply",
      value: String(noReplyCount),
      sub: "Tex never responded — critical",
      critical: noReplyCount > 0,
    },
    { label: "Last Run", value: lastRunLabel, sub: lastRunRange, critical: false },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
      {tiles.map((t) => (
        <div
          key={t.label}
          style={t.critical ? { ...cardStyle, background: "#fef2f2", border: "1px solid #fecaca" } : cardStyle}
        >
          <div style={{ ...cardTitle, color: t.critical ? "#b91c1c" : cardTitle.color }}>{t.label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: t.critical ? "#b91c1c" : "#0f1e2d" }}>{t.value}</div>
          <div style={{ fontSize: 12, color: t.critical ? "#b91c1c" : "#9ea3b8", marginTop: 4 }}>{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Score distribution (1-5 bars) ────────────────────────────────────────────

export function ScoreDistribution({ conversations }: { conversations: Conversation[] }) {
  const scored = conversations.filter((c) => typeof c.csat_score === "number");
  if (scored.length === 0) return null;

  const counts = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: scored.filter((c) => c.csat_score === score).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div style={cardStyle}>
      <div style={cardTitle}>Score Distribution ({scored.length} scored)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {counts.map((c) => {
          const pct = Math.round((c.count / max) * 100);
          const color = c.score >= 4 ? "#137333" : c.score === 3 ? "#7a5200" : "#b91c1c";
          return (
            <div key={c.score} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 16, fontSize: 12, color: "#5a6478" }}>{c.score}</span>
              <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 4, height: 10 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4 }} />
              </div>
              <span style={{ width: 30, fontSize: 12, color: "#5a6478", textAlign: "right" }}>{c.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sentiment split (donut) ──────────────────────────────────────────────────

export function SentimentDonut({ conversations }: { conversations: Conversation[] }) {
  const total = conversations.length;
  if (total === 0) return null;

  const counts: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const c of conversations) counts[normSentiment(c.sentiment)] += 1;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = SENTIMENT_ORDER.map((key) => {
    const count = counts[key];
    const pct = count / total;
    const dash = pct * circumference;
    const seg = { key, count, dash, offset };
    offset += dash;
    return seg;
  }).filter((s) => s.count > 0);

  const positivePct = Math.round((counts.positive / total) * 100);

  return (
    <div style={cardStyle}>
      <div style={cardTitle}>Sentiment Split ({total} conversations)</div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle cx="65" cy="65" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="16" />
            {segments.map((s) => (
              <circle
                key={s.key}
                cx="65"
                cy="65"
                r={radius}
                fill="none"
                stroke={SENTIMENT_STYLE[s.key].fg}
                strokeWidth="16"
                strokeDasharray={`${s.dash} ${circumference - s.dash}`}
                strokeDashoffset={-s.offset}
                transform="rotate(-90 65 65)"
              />
            ))}
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f1e2d" }}>{positivePct}%</div>
            <div style={{ fontSize: 9, color: "#9ea3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Positive
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SENTIMENT_ORDER.map((key) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: SENTIMENT_STYLE[key].fg,
                  display: "inline-block",
                }}
              />
              <span style={{ color: "#5a6478" }}>{SENTIMENT_STYLE[key].label}</span>
              <span style={{ fontWeight: 700, color: "#0f1e2d" }}>{counts[key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Avg CSAT over time (line) ────────────────────────────────────────────────

export function CsatOverTime({ conversations }: { conversations: Conversation[] }) {
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const c of conversations) {
    if (!c.occurred_at || typeof c.csat_score !== "number") continue;
    const day = new Date(c.occurred_at).toISOString().slice(0, 10);
    const entry = byDay.get(day) ?? { sum: 0, count: 0 };
    entry.sum += c.csat_score;
    entry.count += 1;
    byDay.set(day, entry);
  }

  const days = Array.from(byDay.keys()).sort();
  if (days.length < 2) return null;

  const points = days.map((d) => {
    const e = byDay.get(d)!;
    return { day: d, avg: e.sum / e.count };
  });

  const width = 600;
  const height = 160;
  const padding = 24;
  const xStep = (width - padding * 2) / Math.max(1, points.length - 1);
  const yFor = (avg: number) => height - padding - ((avg - 1) / 4) * (height - padding * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${padding + i * xStep} ${yFor(p.avg)}`)
    .join(" ");

  return (
    <div style={cardStyle}>
      <div style={cardTitle}>Avg CSAT Over Time</div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e8eaf2" />
        <path d={pathD} fill="none" stroke="#258ed8" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={p.day}>
            <circle cx={padding + i * xStep} cy={yFor(p.avg)} r="4" fill="#258ed8" />
            {(i === 0 || i === points.length - 1) && (
              <text
                x={padding + i * xStep}
                y={yFor(p.avg) - 10}
                fontSize="11"
                textAnchor="middle"
                fill="#5a6478"
              >
                {p.avg.toFixed(1)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ea3b8" }}>
        <span>{points[0].day}</span>
        <span>{points[points.length - 1].day}</span>
      </div>
    </div>
  );
}

export function sentimentPillStyle(sentiment: string | null) {
  return SENTIMENT_STYLE[normSentiment(sentiment)];
}
