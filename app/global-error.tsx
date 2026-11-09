"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          background: "#f4f6f0",
          color: "#172019",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "28rem",
            border: "1px solid #d8dfd2",
            borderRadius: "18px",
            background: "#fbfcf8",
            padding: "1.75rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Something went sideways.</h1>
          <p style={{ marginTop: "0.5rem", color: "#5e6b5f", lineHeight: 1.6 }}>
            LendLoop hit an unexpected error. Your data is safe. Reload to try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              minHeight: "2.5rem",
              padding: "0 1.25rem",
              border: 0,
              borderRadius: "999px",
              background: "#2e5d43",
              color: "#f7faf4",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload LendLoop
          </button>
        </main>
      </body>
    </html>
  );
}
