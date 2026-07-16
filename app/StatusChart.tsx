const STATUS_ORDER = ["PASS", "WARN", "FAIL", "ERROR"] as const;

const STATUS_STYLE: Record<string, { fg: string; bg: string; label: string }> = {
  PASS: { fg: "#137333", bg: "#e6f4ea", label: "Pass" },
  WARN: { fg: "#7a5200", bg: "#fef9e7", label: "Warn" },
  FAIL: { fg: "#b91c1c", bg: "#fef2f2", label: "Fail" },
  ERROR: { fg: "#475569", bg: "#f1f5f9", label: "Error" },
};

export default function StatusChart({ runs }: { runs: { status: string }[] }) {
  const counts: Record<string, number> = { PASS: 0, WARN: 0, FAIL: 0, ERROR: 0 };
  for (const r of runs) {
    const key = (r.status || "").toUpperCase();
    if (key in counts) counts[key] += 1;
  }

  const max = Math.max(1, ...Object.values(counts));
  const total = runs.length;

  if (total === 0) return null;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        padding: "16px 20px",
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#5a6478", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Result breakdown ({total} test{total === 1 ? "" : "s"})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {STATUS_ORDER.map((key) => {
          const style = STATUS_STYLE[key];
          const count = counts[key];
          const widthPct = (count / max) * 100;
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }} title={`${style.label}: ${count}`}>
              <div style={{ width: 48, fontSize: 12, fontWeight: 700, color: style.fg }}>{style.label}</div>
              <div style={{ flex: 1, background: "#f5f6fa", borderRadius: 4, height: 14 }}>
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: "100%",
                    background: style.fg,
                    borderRadius: 4,
                    minWidth: count > 0 ? 4 : 0,
                    transition: "width .2s",
                  }}
                />
              </div>
              <div style={{ width: 28, fontSize: 12, color: "#5a6478", textAlign: "right" }}>{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
