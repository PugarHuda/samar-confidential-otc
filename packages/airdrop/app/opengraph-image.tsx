import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Confidential Airdrop — TokenOps × Zama";

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
          background: "#0B0A11",
          color: "#E7E4F2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 2, color: "#7B6CF6", fontWeight: 700 }}>
          TOKENOPS SDK · ZAMA fhEVM · SEPOLIA
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 90, fontWeight: 800, lineHeight: 1.05 }}>Confidential Airdrop</div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 34, color: "#B7B2C9" }}>
          Distribute tokens where every recipient&apos;s allocation stays encrypted. Only you can read your share.
        </div>
        <div style={{ display: "flex", marginTop: 44 }}>
          <div style={{ display: "flex", background: "#7B6CF6", color: "#fff", padding: "12px 26px", borderRadius: 999, fontSize: 28, fontWeight: 700 }}>
            samar-airdrop.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
