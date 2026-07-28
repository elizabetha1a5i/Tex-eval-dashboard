"use client";

import { useEffect, useState } from "react";

type Conversation = {
  id: string | number;
  external_id: string | null;
  customer_ref: string | null;
  occurred_at: string | null;
  transcript_text: string;
  csat_score: number | null;
  sentiment: string | null;
  resolved: boolean | null;
  summary: string | null;
  qa_status: string | null;
  qa_alignment_score: number | null;
  qa_issues: string | null;
  no_reply: boolean | null;
  notes: string | null;
  reviewed: boolean | null;
};

function getStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("evalDashboardKey");
}

function LoginGate({ onSuccess }: { onSuccess: (key: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit() {
    if (!input) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: input }),
      });
      if (res.ok) {
        window.sessionStorage.setItem("evalDashboardKey", input);
        onSuccess(input);
      } else {
        setError("Incorrect key.");
      }
    } catch {
      setError("Could not verify key — try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: "120px auto", padding: 24, textAlign: "center" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Review Customer Conversations</h1>
      <p style={{ color: "#5a6478", fontSize: 13, marginBottom: 20 }}>
        Enter the dashboard key to access reviewer tools.
      </p>
      <input
        type="password"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Dashboard key"
        autoFocus
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #ccc",
          fontSize: 14,
          marginBottom: 12,
          boxSizing: "border-box",
        }}
      />
      <button
        onClick={submit}
        disabled={checking || !input}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #258ed8",
          background: "#258ed8",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {checking ? "Checking…" : "Enter"}
      </button>
      {error && <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 12 }}>{error}</p>}
    </main>
  );
}

function isFlagged(c: Conversation) {
  return c.no_reply === true || c.qa_status === "FAIL";
}

function ReviewList({ authKey }: { authKey: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { notes: string; reviewed: boolean; csat_score: string; sentiment: string; qa_status: string }>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/csat?limit=1000");
    const data = await res.json();
    const rows: Conversation[] = data.conversations ?? [];
    setConversations(rows);
    const d: typeof drafts = {};
    for (const c of rows) {
      d[c.id] = {
        notes: c.notes ?? "",
        reviewed: c.reviewed ?? false,
        csat_score: c.csat_score != null ? String(c.csat_score) : "",
        sentiment: c.sentiment ?? "",
        qa_status: c.qa_status ?? "",
      };
    }
    setDrafts(d);
    setLoading(false);
  }

  function authHeaders() {
    return { Authorization: `Bearer ${authKey}`, "Content-Type": "application/json" };
  }

  function handleUnauthorized() {
    window.sessionStorage.removeItem("evalDashboardKey");
    alert("Key no longer valid — please refresh and re-enter it.");
  }

  async function save(id: string | number) {
    const draft = drafts[id];
    setSaving(id);
    try {
      const res = await fetch(`/api/csat/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          notes: draft.notes,
          reviewed: draft.reviewed,
          csat_score: draft.csat_score ? Number(draft.csat_score) : undefined,
          sentiment: draft.sentiment || undefined,
          qa_status: draft.qa_status || undefined,
        }),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        alert("Save failed — check console for details.");
        console.error(await res.text());
        return;
      }
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function markResolved(id: string | number) {
    setSaving(id);
    try {
      const res = await fetch(`/api/csat/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ reviewed: true, resolved: true }),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        alert("Update failed — check console for details.");
        console.error(await res.text());
        return;
      }
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function remove(id: string | number) {
    if (!window.confirm("Delete this conversation permanently?")) return;
    setSaving(id);
    try {
      const res = await fetch(`/api/csat/${id}`, { method: "DELETE", headers: authHeaders() });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        alert("Delete failed — check console for details.");
        console.error(await res.text());
        return;
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <main style={{ padding: 32 }}>Loading…</main>;
  }

  const flagged = conversations.filter(isFlagged);
  const visible = showAll ? conversations : flagged;

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Review Customer Conversations</h1>
      <p style={{ color: "#5a6478", marginBottom: 16 }}>
        Add notes, override AI scores, or mark flagged conversations as resolved.
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <button
          onClick={() => setShowAll(false)}
          style={{
            padding: "6px 16px", borderRadius: 8, border: "1px solid #ccc",
            background: !showAll ? "#258ed8" : "#fff", color: !showAll ? "#fff" : "#5a6478", cursor: "pointer",
          }}
        >
          Flagged ({flagged.length})
        </button>
        <button
          onClick={() => setShowAll(true)}
          style={{
            padding: "6px 16px", borderRadius: 8, border: "1px solid #ccc",
            background: showAll ? "#258ed8" : "#fff", color: showAll ? "#fff" : "#5a6478", cursor: "pointer",
          }}
        >
          Show All ({conversations.length})
        </button>
      </div>

      {visible.map((c) => {
        const draft = drafts[c.id] ?? { notes: "", reviewed: false, csat_score: "", sentiment: "", qa_status: "" };
        return (
          <div
            key={c.id}
            style={{
              background: "#fff",
              border: isFlagged(c) ? "1px solid #fecaca" : "1px solid #e8eaf2",
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <strong>{c.customer_ref || c.external_id || "Unknown"}</strong>
              <span style={{ color: "#9ea3b8", fontSize: 12 }}>
                {c.occurred_at ? new Date(c.occurred_at).toLocaleString() : "-"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              {c.no_reply && (
                <span style={{ background: "#fef2f2", color: "#b91c1c", padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 11 }}>
                  NO REPLY
                </span>
              )}
              {c.qa_status && (
                <span
                  style={{
                    background: c.qa_status === "PASS" ? "#e6f4ea" : c.qa_status === "WARN" ? "#fef9e7" : "#fef2f2",
                    color: c.qa_status === "PASS" ? "#137333" : c.qa_status === "WARN" ? "#7a5200" : "#b91c1c",
                    padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 11,
                  }}
                >
                  QA {c.qa_status}
                </span>
              )}
              {c.reviewed && (
                <span style={{ background: "#e6f4ea", color: "#137333", padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 11 }}>
                  REVIEWED
                </span>
              )}
            </div>

            <div style={{ color: "#5a6478", fontSize: 13, marginBottom: 8 }}>
              {c.summary || "-"} {c.qa_issues ? `— Issues: ${c.qa_issues}` : ""}
            </div>

            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", color: "#258ed8", fontSize: 13 }}>View transcript</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{c.transcript_text}</pre>
            </details>

            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 10 }}>
              <select
                value={draft.csat_score}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: { ...draft, csat_score: e.target.value } }))}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc" }}
              >
                <option value="">CSAT: -</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}/5</option>
                ))}
              </select>

              <select
                value={draft.sentiment}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: { ...draft, sentiment: e.target.value } }))}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc" }}
              >
                <option value="">Sentiment: -</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>

              <select
                value={draft.qa_status}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: { ...draft, qa_status: e.target.value } }))}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc" }}
              >
                <option value="">Rule status: -</option>
                <option value="PASS">PASS</option>
                <option value="WARN">WARN</option>
                <option value="FAIL">FAIL</option>
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5a6478" }}>
                <input
                  type="checkbox"
                  checked={draft.reviewed}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: { ...draft, reviewed: e.target.checked } }))}
                />
                Reviewed
              </label>
            </div>

            <textarea
              value={draft.notes}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: { ...draft, notes: e.target.value } }))}
              placeholder="Reviewer notes..."
              rows={2}
              style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ccc", marginBottom: 10, boxSizing: "border-box" }}
            />

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => save(c.id)}
                disabled={saving === c.id}
                style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #258ed8", background: "#258ed8", color: "#fff", cursor: "pointer" }}
              >
                {saving === c.id ? "Saving…" : "Save"}
              </button>

              {isFlagged(c) && !c.reviewed && (
                <button
                  onClick={() => markResolved(c.id)}
                  disabled={saving === c.id}
                  style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #137333", background: "#fff", color: "#137333", cursor: "pointer" }}
                >
                  Mark Resolved
                </button>
              )}

              <button
                onClick={() => remove(c.id)}
                disabled={saving === c.id}
                style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #b91c1c", background: "#fff", color: "#b91c1c", cursor: "pointer" }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <p style={{ color: "#9ea3b8" }}>{showAll ? "No conversations yet." : "Nothing flagged — all clear."}</p>
      )}
    </main>
  );
}

export default function CsatReviewPage() {
  const [authKey, setAuthKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const stored = getStoredKey();
    if (!stored) {
      setChecked(true);
      return;
    }
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: stored }),
    })
      .then((res) => {
        if (res.ok) setAuthKey(stored);
        else window.sessionStorage.removeItem("evalDashboardKey");
      })
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return <main style={{ padding: 32 }}>Loading…</main>;
  }

  if (!authKey) {
    return <LoginGate onSuccess={(key) => setAuthKey(key)} />;
  }

  return <ReviewList authKey={authKey} />;
}
