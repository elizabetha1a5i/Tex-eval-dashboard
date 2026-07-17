"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Run = {
  id: string | number;
  run_date: string;
  name: string;
  category: string;
  environment: string;
  status: string;
  score: string | null;
  summary: string | null;
  notes: string | null;
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
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Review Results</h1>
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

function ReviewList({ authKey, focusId }: { authKey: string; focusId: string | null }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { status: string; notes: string }>>({});
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  function toggleSelected(id: string | number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === visibleRuns.length ? new Set() : new Set(visibleRuns.map((r) => r.id))));
  }

  useEffect(() => {
    fetch("/api/eval-results?limit=200")
      .then((r) => r.json())
      .then((data) => {
        setRuns(data.runs ?? []);
        const d: Record<string, { status: string; notes: string }> = {};
        for (const r of data.runs ?? []) {
          d[r.id] = { status: r.status ?? "", notes: r.notes ?? "" };
        }
        setDrafts(d);
      })
      .finally(() => setLoading(false));
  }, []);

  function authHeaders(extra?: Record<string, string>) {
    return { Authorization: `Bearer ${authKey}`, ...(extra ?? {}) };
  }

  function handleUnauthorized() {
    window.sessionStorage.removeItem("evalDashboardKey");
    alert("Key no longer valid — please refresh and re-enter it.");
  }

  async function save(id: string | number) {
    setSaving(id);
    try {
      const res = await fetch(`/api/eval-results/${id}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(drafts[id]),
      });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        alert("Save failed — check console for details.");
        console.error(await res.text());
        return;
      }
      setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, ...drafts[id] } : r)));
    } finally {
      setSaving(null);
    }
  }

  async function remove(id: string | number) {
    if (!window.confirm("Delete this test result permanently?")) return;
    setSaving(id);
    try {
      const res = await fetch(`/api/eval-results/${id}`, { method: "DELETE", headers: authHeaders() });
      if (res.status === 401) return handleUnauthorized();
      if (!res.ok) {
        alert("Delete failed — check console for details.");
        console.error(await res.text());
        return;
      }
      setRuns((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setSaving(null);
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} selected result(s) permanently?`)) return;

    setBulkDeleting(true);
    try {
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/eval-results/${id}`, { method: "DELETE", headers: authHeaders() }))
      );

      if (results.some((r) => r.status === 401)) return handleUnauthorized();

      const deletedIds = new Set(ids.filter((_, i) => results[i].ok));
      setRuns((prev) => prev.filter((r) => !deletedIds.has(r.id)));
      setSelected(new Set());

      const failedCount = ids.length - deletedIds.size;
      if (failedCount > 0) alert(`${failedCount} deletion(s) failed — check console for details.`);
    } finally {
      setBulkDeleting(false);
    }
  }

  if (loading) {
    return <main style={{ padding: 32 }}>Loading…</main>;
  }

  const visibleRuns = focusId ? runs.filter((r) => String(r.id) === String(focusId)) : runs;

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Review Results</h1>
      <p style={{ color: "#5a6478", marginBottom: 16 }}>
        Amend a result's status or add reviewer notes. Changes save directly to the database.
      </p>

      {focusId && (
        <a href="/review" style={{ color: "#258ed8", fontSize: 13, fontWeight: 600, display: "inline-block", marginBottom: 16 }}>
          ← Back to all results
        </a>
      )}

      {!focusId && visibleRuns.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#5a6478" }}>
            <input type="checkbox" checked={selected.size === visibleRuns.length} onChange={toggleSelectAll} />
            Select all
          </label>
          <button
            onClick={bulkDelete}
            disabled={selected.size === 0 || bulkDeleting}
            style={{
              padding: "6px 16px",
              borderRadius: 8,
              border: "1px solid #b91c1c",
              background: selected.size === 0 ? "#fff" : "#b91c1c",
              color: selected.size === 0 ? "#b91c1c" : "#fff",
              cursor: selected.size === 0 ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            {bulkDeleting ? "Deleting…" : `Delete Selected (${selected.size})`}
          </button>
        </div>
      )}

      {visibleRuns.map((r) => {
        const draft = drafts[r.id] ?? { status: r.status, notes: r.notes ?? "" };
        return (
          <div
            key={r.id}
            style={{
              background: "#fff",
              border: "1px solid #e8eaf2",
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!focusId && (
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelected(r.id)} />
                )}
                <strong>{r.name}</strong>
              </label>
              <span style={{ color: "#9ea3b8", fontSize: 12 }}>
                {new Date(r.run_date).toLocaleString()}
              </span>
            </div>
            <div style={{ color: "#5a6478", fontSize: 13, marginBottom: 12 }}>
              {r.category} · {r.environment} · {r.score ?? "-"}
            </div>
            <div style={{ color: "#5a6478", fontSize: 13, marginBottom: 12 }}>
              {r.summary}
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <select
                value={draft.status}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [r.id]: { ...draft, status: e.target.value } }))
                }
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ccc" }}
              >
                <option value="PASS">PASS</option>
                <option value="WARN">WARN</option>
                <option value="FAIL">FAIL</option>
                <option value="ERROR">ERROR</option>
              </select>

              <textarea
                value={draft.notes}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [r.id]: { ...draft, notes: e.target.value } }))
                }
                placeholder="Reviewer notes..."
                rows={2}
                style={{ flex: 1, minWidth: 240, padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
              />

              <button
                onClick={() => save(r.id)}
                disabled={saving === r.id}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  border: "1px solid #258ed8",
                  background: "#258ed8",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                {saving === r.id ? "Saving…" : "Save"}
              </button>

              <button
                onClick={() => remove(r.id)}
                disabled={saving === r.id}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  border: "1px solid #b91c1c",
                  background: "#fff",
                  color: "#b91c1c",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}

      {visibleRuns.length === 0 && (
        <p style={{ color: "#9ea3b8" }}>
          {focusId ? "That result could not be found." : "No results to review yet."}
        </p>
      )}
    </main>
  );
}

function ReviewPageInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
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

  return <ReviewList authKey={authKey} focusId={focusId} />;
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32 }}>Loading…</main>}>
      <ReviewPageInner />
    </Suspense>
  );
}
