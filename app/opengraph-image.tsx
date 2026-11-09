import { ImageResponse } from "next/og";

export const alt = "LendLoop — Borrow what you need. Lend what you don't.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "#111713",
        color: "#f4f6f0",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "#2f5d3a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "30px",
            fontWeight: 700,
          }}
        >
          L
        </div>
        <span style={{ fontSize: "30px", fontWeight: 600 }}>LendLoop</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
        <span
          style={{
            fontSize: "76px",
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            maxWidth: "900px",
          }}
        >
          Borrow what you need.
          <br />
          Lend what you don&apos;t.
        </span>
        <span style={{ fontSize: "30px", color: "#a8b5a6" }}>
          A calmer neighborhood tool board.
        </span>
      </div>
      <div style={{ display: "flex", gap: "12px" }}>
        {["Request", "Approve", "Return", "Remember"].map((step) => (
          <span
            key={step}
            style={{
              border: "1px solid #36443a",
              borderRadius: "999px",
              padding: "10px 18px",
              fontSize: "22px",
              color: "#d9e2d4",
            }}
          >
            {step}
          </span>
        ))}
      </div>
    </div>,
    size,
  );
}
