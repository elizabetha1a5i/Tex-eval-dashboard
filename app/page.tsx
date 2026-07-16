import { listRuns, ensureSchema } from "@/lib/db";
import { StatTiles, ResultsDonut, CategoryBreakdown, PassRateOverTime } from "./Charts";
import SendToSlackButton from "./SendToSlackButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusColor(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "pass") return { bg: "#e6f4ea", fg: "#137333" };
  if (s === "warn") return { bg: "#fef9e7", fg: "#7a5200" };
  return { bg: "#fef2f2", fg: "#b91c1c" };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: {
    environment?: string;
    category?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}) {
  await ensureSchema();
  const runs = await listRuns({
    environment: searchParams.environment,
    category: searchParams.category,
    status: searchParams.status,
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo ? `${searchParams.dateTo}T23:59:59.999` : undefined,
    limit: 200,
  });

  const categories = Array.from(new Set(runs.map((r: any) => r.category).filter(Boolean)));
  const environments = Array.from(new Set(runs.map((r: any) => r.environment).filter(Boolean)));

  const qs = new URLSearchParams();
  if (searchParams.environment) qs.set("environment", searchParams.environment);
  if (searchParams.category) qs.set("category", searchParams.category);
  if (searchParams.status) qs.set("status", searchParams.status);
  if (searchParams.dateFrom) qs.set("dateFrom", searchParams.dateFrom);
  if (searchParams.dateTo) qs.set("dateTo", searchParams.dateTo);
  const queryString = qs.toString() ? `?${qs.toString()}` : "";

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Tex Eval Dashboard</h1>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <SendToSlackButton queryString={queryString} />
          <a href="/review" style={{ color: "#258ed8", fontSize: 13, fontWeight: 600 }}>Review results →</a>
        </div>
      </div>
      <p style={{ color: "#5a6478", marginBottom: 24 }}>
        Dynamic eval results, pushed automatically from GitHub Actions.
      </p>

      <StatTiles runs={runs as any} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <PassRateOverTime runs={runs as any} />
        <ResultsDonut runs={runs as any} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <CategoryBreakdown runs={runs as any} />
      </div>

      <form style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select name="environment" defaultValue={searchParams.environment ?? ""}>
          <option value="">All environments</option>
          {environments.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select name="category" defaultValue={searchParams.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""}>
          <option value="">All statuses</option>
          <option value="pass">Pass</option>
          <option value="warn">Warn</option>
          <option value="fail">Fail</option>
        </select>
        <input
          type="date"
          name="dateFrom"
          defaultValue={searchParams.dateFrom ?? ""}
          style={{ border: "1.5px solid #e8eaf2", borderRadius: 8, padding: "5px 10px", fontSize: 12 }}
        />
        <span style={{ color: "#9ea3b8", fontSize: 12 }}>to</span>
        <input
          type="date"
          name="dateTo"
          defaultValue={searchParams.dateTo ?? ""}
          style={{ border: "1.5px solid #e8eaf2", borderRadius: 8, padding: "5px 10px", fontSize: 12 }}
        />
        <button type="submit" style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #ccc" }}>
          Filter
        </button>
      </form>

      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#f5f6fa" }}>
              {["Date", "Name", "Category", "Env", "Status", "Score", "Importance", "Summary", "Screenshot", "Transcript"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", borderBottom: "1px solid #e8eaf2" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map((r: any) => {
              const c = statusColor(r.status);
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid #f0f1f6" }}>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    {new Date(r.run_date).toLocaleString()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>{r.name}</td>
                  <td style={{ padding: "10px 14px" }}>{r.category}</td>
                  <td style={{ padding: "10px 14px" }}>{r.environment}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: c.bg, color: c.fg, padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>{r.score ?? "-"}</td>
                  <td style={{ padding: "10px 14px" }}>{r.importance ?? "-"}</td>
                  <td style={{ padding: "10px 14px", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.summary || "-"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {r.screenshot_path ? (
                      <a href={r.screenshot_path} target="_blank" rel="noreferrer">View</a>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {r.conversation_text ? (
                      <details>
                        <summary style={{ cursor: "pointer", color: "#258ed8" }}>View</summary>
                        <pre style={{ whiteSpace: "pre-wrap", maxWidth: 400, fontSize: 12, marginTop: 8 }}>
                          {r.conversation_text}
                        </pre>
                      </details>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
            {runs.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: 24, textAlign: "center", color: "#9ea3b8" }}>
                  No results yet — run the eval workflow to populate this dashboard.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
