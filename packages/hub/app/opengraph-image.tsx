import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Samar — a confidential-finance stack on Zama";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 90, background: "#0B0A11", color: "#E7E4F2", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 3, color: "#7B6CF6", fontWeight: 700 }}>CONFIDENTIAL FINANCE · ZAMA fhEVM</div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>On-chain finance,</div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>
          <span>numbers stay&nbsp;</span>
          <span style={{ color: "#7B6CF6" }}>encrypted.</span>
        </div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 32, color: "#B7B2C9" }}>OTC desk · wrapper registry · confidential airdrop — three apps, one stack.</div>
      </div>
    ),
    { ...size },
  );
}
