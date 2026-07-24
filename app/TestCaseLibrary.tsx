"use client";

import { useEffect, useState, ReactNode } from "react";

export type TestCaseRow = {
  id: string;
  title: string;
  category: string | null;
  owner: string | null;
  status: string;
  version: number;
  expected_result: string | null;
  conversation: { user: string; wait_for_response?: boolean }[];
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  draft: { bg: "#eee", fg: "#666" },
  in_review: { bg: "#fef9e7", fg: "#7a5200" },
  approved: { bg: "#e7f3fa", fg: "#0c5460" },
  active: { bg: "#e6f4ea", fg: "#137333" },
  deprecated: { bg: "#fef2f2", fg: "#b91c1c" },
};

const STATUS_NEXT: Record<string, string> = {
  draft: "in_review",
  in_review: "approved",
  approved: "active",
  active: "deprecated",
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#eee", fg: "#666" };
  return (
    <span style={{ background: c.bg, color: c.fg, padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
      {status}
    </span>
  );
}

function tableShell(rows: TestCaseRow[], actions?: (row: TestCaseRow) => ReactNode) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.06)", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", background: "#f5f6fa" }}>
            {["ID", "Title", "Category", "Owner", "v", "Status", ...(actions ? ["Actions"] : [])].map((h) => (
              <th key={h} style={{ padding: "10px 14px", borderBottom: "1px solid #e8eaf2" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid #f0f1f6" }}>
              <td style={{ padding: "10px 14px" }}><code>{t.id}</code></td>
              <td style={{ padding: "10px 14px" }}>{t.title}</td>
              <td style={{ padding: "10px 14px" }}>{t.category ?? "-"}</td>
              <td style={{ padding: "10px 14px" }}>{t.owner ?? "-"}</td>
              <td style={{ padding: "10px 14px" }}>{t.version}</td>
              <td style={{ padding: "10px 14px" }}><StatusPill status={t.status} /></td>
              {actions && <td style={{ padding: "10px 14px" }}>{actions(t)}</td>}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={actions ? 7 : 6} style={{ padding: 24, textAlign: "center", color: "#9ea3b8" }}>
                No test cases yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Read-only view for the public dashboard — active/approved only, no auth. */
export function TestCaseLibraryReadOnly({ testCases }: { testCases: TestCaseRow[] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Test Case Library ({testCases.length})</h2>
      {tableShell(testCases)}
    </div>
  );
}

/** Interactive authoring/approval view for the review page. */
export function TestCaseLibraryEditor({ authKey }: { authKey: string }) {
  const [testCases, setTestCases] = useState<TestCaseRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: "", title: "", category: "", owner: "", expected_result: "", conversation: "" });
  const [saving, setSaving] = useState<string | null>(null);

  function authHeaders() {
    return { Authorization: `Bearer ${authKey}`, "Content-Type": "application/json" };
  }

  async function load() {
    const res = await fetch("/api/test-cases");
    const data = await res.json();
    setTestCases(data.test_cases ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  if (!loaded) {
    return <p style={{ color: "#9ea3b8" }}>Loading test case library…</p>;
  }

  async function createDraft() {
    if (!form.id || !form.title) {
      alert("ID and Title are required.");
      return;
    }
    setSaving(form.id);
    const conversation = form.conversation
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((m) => ({ user: m, wait_for_response: true }));

    const res = await fetch("/api/test-cases", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ ...form, conversation, status: "draft" }),
    });
    setSaving(null);
    if (!res.ok) {
      alert("Save failed — check console for details.");
      console.error(await res.text());
      return;
    }
    setForm({ id: "", title: "", category: "", owner: "", expected_result: "", conversation: "" });
    setShowForm(false);
    await load();
  }

  async function setStatus(id: string, status: string) {
    setSaving(id);
    const res = await fetch(`/api/test-cases/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    setSaving(null);
    if (!res.ok) {
      alert("Update failed — check console for details.");
      console.error(await res.text());
      return;
    }
    await load();
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Test Case Library ({testCases.length})</h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #258ed8", background: "#258ed8", color: "#fff", cursor: "pointer" }}
        >
          {showForm ? "Cancel" : "+ New Test Case"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#fff", border: "1px solid #e8eaf2", borderRadius: 12, padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
          <input placeholder="ID (e.g. COCKTAIL-21)" value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} />
          <input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <input placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
          <input placeholder="Owner" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
          <textarea placeholder="Expected result / pass criteria" rows={2} value={form.expected_result} onChange={(e) => setForm((f) => ({ ...f, expected_result: e.target.value }))} />
          <textarea placeholder="Conversation (one user message per line)" rows={3} value={form.conversation} onChange={(e) => setForm((f) => ({ ...f, conversation: e.target.value }))} />
          <button
            onClick={createDraft}
            disabled={saving === form.id}
            style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid #258ed8", background: "#258ed8", color: "#fff", cursor: "pointer", justifySelf: "start" }}
          >
            {saving === form.id ? "Saving…" : "Save as Draft"}
          </button>
        </div>
      )}

      {tableShell(testCases, (t) => (
        <div style={{ display: "flex", gap: 8 }}>
          {STATUS_NEXT[t.status] && (
            <button
              onClick={() => setStatus(t.id, STATUS_NEXT[t.status])}
              disabled={saving === t.id}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #258ed8", background: "#fff", color: "#258ed8", cursor: "pointer", fontSize: 12 }}
            >
              → {STATUS_NEXT[t.status]}
            </button>
          )}
          {t.status !== "deprecated" && (
            <button
              onClick={() => setStatus(t.id, "deprecated")}
              disabled={saving === t.id}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #b91c1c", background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 12 }}
            >
              Deprecate
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
