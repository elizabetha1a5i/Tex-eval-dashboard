"use client";

import { useState } from "react";

export default function CollapsibleTable({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          onClick={() => setHidden((h) => !h)}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            color: "#5a6478",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {hidden ? "Show Table" : "Hide Table"}
        </button>
      </div>
      {!hidden && children}
    </div>
  );
}
