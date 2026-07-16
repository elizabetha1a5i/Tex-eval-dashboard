"use client";

import { useState } from "react";

function getKey(): string | null {
  if (typeof window === "undefined") return null;
  let key = window.sessionStorage.getItem("evalDashboardKey");
  if (!key) {
    key = window.prompt("Enter the dashboard key to send to Slack:");
    if (key) window.sessionStorage.setItem("evalDashboardKey", key);
  }
  return key;
}

export default function SendToSlackButton({ queryString }: { queryString: string }) {
  const [sending, setSending] = useState(false);

  async function send() {
    const key = getKey();
    if (!key) return;

    setSending(true);
    try {
      const res = await fetch(`/api/send-slack-summary${queryString}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
      });
      if (res.status === 401) {
        window.sessionStorage.removeItem("evalDashboardKey");
        alert("Incorrect key — try again.");
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(body.error || "Failed to send to Slack.");
        return;
      }
      alert("Sent to Slack.");
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      onClick={send}
      disabled={sending}
      style={{
        padding: "6px 16px",
        borderRadius: 8,
        border: "1px solid #4a154b",
        background: "#4a154b",
        color: "#fff",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {sending ? "Sending…" : "Send to Slack"}
    </button>
  );
}
