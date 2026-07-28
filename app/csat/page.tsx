import { listCsatConversations, ensureCsatSchema } from "@/lib/db";
import { CsatStatTiles, ScoreDistribution, SentimentDonut, CsatOverTime, sentimentPillStyle } from "../CsatCharts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CsatPage({
  searchParams,
}: {
  searchParams: { sentiment?: string; dateFrom?: string; dateTo?: string };
}) {
  await ensureCsatSchema();
  const conversations = await listCsatConversations({
    sentiment: searchParams.sentiment,
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo ? `${searchParams.dateTo}T23:59:59.999` : undefined,
    limit: 500,
  });

  const qs = new URLSearchParams();
  if (searchParams.sentiment) qs.set("sentiment", searchParams.sentiment);
  if (searchParams.dateFrom) qs.set("dateFrom", searchParams.dateFrom);
  if (searchParams.dateTo) qs.set("dateTo", searchParams.dateTo);
  const queryString = qs.toString() ? `?${qs.toString()}` : "";

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Customer CSAT</h1>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/csat/review" style={{ color: "#258ed8", fontSize: 13, fontWeight: 600 }}>Review →</a>
          <a href="/" style={{ color: "#258ed8", fontSize: 13, fontWeight: 600 }}>← Back to eval dashboard</a>
        </div>
      </div>
      <p style={{ color: "#5a6478", marginBottom: 8 }}>
        AI-scored analysis of real customer conversations, imported from Community.com exports.
      </p>
      {(() => {
        const needsReview = (conversations as any[]).filter(
          (c) => (c.no_reply === true || c.qa_status === "FAIL") && !c.reviewed
        ).length;
        return needsReview > 0 ? (
          <p style={{ color: "#b91c1c", fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
            ⚠ {needsReview} flagged conversation{needsReview === 1 ? "" : "s"} need review —{" "}
            <a href="/csat/review" style={{ color: "#b91c1c", textDecoration: "underline" }}>review now</a>
          </p>
        ) : (
          <div style={{ marginBottom: 24 }} />
        );
      })()}

      <CsatStatTiles conversations={conversations as any} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <CsatOverTime conversations={conversations as any} />
        <SentimentDonut conversations={conversations as any} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <ScoreDistribution conversations={conversations as any} />
      </div>

      <form style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <select name="sentiment" defaultValue={searchParams.sentiment ?? ""}>
          <option value="">All sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
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
        {queryString && (
          <a
            href="/csat"
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              border: "1px solid #ccc",
              color: "#5a6478",
              fontSize: 13,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Clear Filters
          </a>
        )}
      </form>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.06)", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#f5f6fa" }}>
              {["Date", "Customer", "Sentiment", "Score", "Resolved", "No Reply", "Summary", "Transcript"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", borderBottom: "1px solid #e8eaf2" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {conversations.map((c: any) => {
              const s = sentimentPillStyle(c.sentiment);
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #f0f1f6" }}>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    {c.occurred_at ? new Date(c.occurred_at).toLocaleString() : "-"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>{c.customer_ref || "-"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: s.bg, color: s.fg, padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                      {s.label}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>{c.csat_score != null ? `${c.csat_score}/5` : "-"}</td>
                  <td style={{ padding: "10px 14px" }}>{c.resolved === true ? "Yes" : c.resolved === false ? "No" : "-"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {c.no_reply === true ? (
                      <span style={{ background: "#fef2f2", color: "#b91c1c", padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                        No Reply
                      </span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "10px 14px", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.summary || "-"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <details>
                      <summary style={{ cursor: "pointer", color: "#258ed8" }}>View</summary>
                      <pre style={{ whiteSpace: "pre-wrap", maxWidth: 400, fontSize: 12, marginTop: 8 }}>
                        {c.transcript_text}
                      </pre>
                    </details>
                  </td>
                </tr>
              );
            })}
            {conversations.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#9ea3b8" }}>
                  No conversations analyzed yet — run analyze_community_csat.py against a Community.com export.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
