import type { CSSProperties } from "react";

type Run = {
  run_date: string;
  category: string;
  status: string;
};

const STATUS_STYLE: Record<string, { fg: string; bg: string; label: string }> = {
  PASS: { fg: "#137333", bg: "#e6f4ea", label: "Pass" },
  WARN: { fg: "#7a5200", bg: "#fef9e7", label: "Warn" },
  FAIL: { fg: "#b91c1c", bg: "#fef2f2", label: "Fail" },
  ERROR: { fg: "#475569", bg: "#f1f5f9", label: "Error" },
};
const STATUS_ORDER = ["PASS", "WARN", "FAIL", "ERROR"] as const;

function normStatus(s: string) {
  const k = (s || "").toUpperCase();
  return k in STATUS_STYLE ? k : "ERROR";
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

export function StatTiles({ runs }: { runs: Run[] }) {
  const total = runs.length;
  const passCount = runs.filter((r) => normStatus(r.status) === "PASS").length;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const categories = Array.from(new Set(runs.map((r) => r.category).filter(Boolean)));
  const cleanCategories = categories.filter((c) =>
    runs.filter((r) => r.category === c).every((r) => normStatus(r.status) === "PASS")
  );
  const warnCount = runs.filter((r) => normStatus(r.status) === "WARN").length;

  const tiles = [
    { label: "Pass Rate", value: `${passRate}%`, sub: `${passCount} of ${total} passing` },
    { label: "Tests Run", value: String(total), sub: `${categories.length} categories` },
    { label: "Warnings", value: String(warnCount), sub: "to monitor" },
    { label: "Clean Categories", value: String(cleanCategories.length), sub: `of ${categories.length} categories` },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
      {tiles.map((t) => (
        <div key={t.label} style={cardStyle}>
          <div style={cardTitle}>{t.label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#0f1e2d" }}>{t.value}</div>
          <div style={{ fontSize: 12, color: "#9ea3b8", marginTop: 4 }}>{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Results split (donut) ────────────────────────────────────────────────────

export function ResultsDonut({ runs }: { runs: Run[] }) {
  const total = runs.length;
  if (total === 0) return null;

  const counts: Record<string, number> = { PASS: 0, WARN: 0, FAIL: 0, ERROR: 0 };
  for (const r of runs) counts[normStatus(r.status)] += 1;

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = STATUS_ORDER.map((key) => {
    const count = counts[key];
    const pct = count / total;
    const dash = pct * circumference;
    const seg = { key, count, dash, offset };
    offset += dash;
    return seg;
  }).filter((s) => s.count > 0);

  const passRate = Math.round((counts.PASS / total) * 100);

  return (
    <div style={cardStyle}>
      <div style={cardTitle}>Results Split ({total} tests)</div>
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
                stroke={STATUS_STYLE[s.key].fg}
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
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f1e2d" }}>{passRate}%</div>
            <div style={{ fontSize: 9, color: "#9ea3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Pass rate
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STATUS_ORDER.map((key) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: STATUS_STYLE[key].fg,
                  display: "inline-block",
                }}
              />
              <span style={{ color: "#5a6478" }}>{STATUS_STYLE[key].label}</span>
              <span style={{ fontWeight: 700, color: "#0f1e2d" }}>{counts[key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── By category (pass rate bars) ────────────────────────────────────────────

export function CategoryBreakdown({ runs }: { runs: Run[] }) {
  const categories = Array.from(new Set(runs.map((r) => r.category).filter(Boolean))).sort();
  if (categories.length === 0) return null;

  const rows = categories.map((cat) => {
    const inCat = runs.filter((r) => r.category === cat);
    const pass = inCat.filter((r) => normStatus(r.status) === "PASS").length;
    const pct = inCat.length > 0 ? Math.round((pass / inCat.length) * 100) : 0;
    return { cat, pass, total: inCat.length, pct };
  });

  return (
    <div style={cardStyle}>
      <div style={cardTitle}>By Category — pass rate</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => {
          const color = r.pct >= 90 ? "#137333" : r.pct >= 70 ? "#7a5200" : "#b91c1c";
          return (
            <div key={r.cat}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#0f1e2d", fontWeight: 600 }}>{r.cat}</span>
                <span style={{ color: "#5a6478" }}>
                  {r.pct}% ({r.pass}/{r.total})
                </span>
              </div>
              <div style={{ background: "#f1f5f9", borderRadius: 4, height: 8 }}>
                <div style={{ width: `${r.pct}%`, height: "100%", background: color, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Pass rate over time (line) ───────────────────────────────────────────────

export function PassRateOverTime({ runs }: { runs: Run[] }) {
  const byDay = new Map<string, { pass: number; total: number }>();
  for (const r of runs) {
    const day = new Date(r.run_date).toISOString().slice(0, 10);
    const entry = byDay.get(day) ?? { pass: 0, total: 0 };
    entry.total += 1;
    if (normStatus(r.status) === "PASS") entry.pass += 1;
    byDay.set(day, entry);
  }

  const days = Array.from(byDay.keys()).sort();
  if (days.length < 2) return null;

  const points = days.map((d) => {
    const e = byDay.get(d)!;
    return { day: d, pct: Math.round((e.pass / e.total) * 100) };
  });

  const width = 600;
  const height = 160;
  const padding = 24;
  const xStep = (width - padding * 2) / Math.max(1, points.length - 1);
  const yFor = (pct: number) => height - padding - (pct / 100) * (height - padding * 2);

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${padding + i * xStep} ${yFor(p.pct)}`)
    .join(" ");

  return (
    <div style={cardStyle}>
      <div style={cardTitle}>Pass Rate Over Time — across all test runs</div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e8eaf2" />
        <path d={pathD} fill="none" stroke="#258ed8" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={p.day}>
            <circle cx={padding + i * xStep} cy={yFor(p.pct)} r="4" fill="#258ed8" />
            {(i === 0 || i === points.length - 1) && (
              <text
                x={padding + i * xStep}
                y={yFor(p.pct) - 10}
                fontSize="11"
                textAnchor="middle"
                fill="#5a6478"
              >
                {p.pct}%
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
