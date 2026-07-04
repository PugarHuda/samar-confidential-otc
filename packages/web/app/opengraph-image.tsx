import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Samar — Confidential OTC Desk on Zama fhEVM";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 90,
          background: "#FFF7EC",
          color: "#1A1625",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 2, color: "#7B6CF6", fontWeight: 700 }}>
          PRIVATE OTC DESK · ZAMA fhEVM
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 100, fontWeight: 800, lineHeight: 1 }}>Trade big.</div>
        <div style={{ display: "flex", fontSize: 100, fontWeight: 800, lineHeight: 1 }}>
          <span style={{ color: "#7B6CF6" }}>Nobody</span>
          <span>&nbsp;peeks.</span>
        </div>
        <div style={{ display: "flex", marginTop: 34, fontSize: 34, color: "#57536A" }}>
          Confidential OTC on Zama fhEVM — size &amp; price stay encrypted.
        </div>
        <div style={{ display: "flex", marginTop: 44 }}>
          <div
            style={{
              display: "flex",
              background: "#7B6CF6",
              color: "#ffffff",
              padding: "12px 26px",
              borderRadius: 999,
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            samar-otc.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
