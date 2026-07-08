import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Landing (light / sticker)
        cream: "#FFF7EC",
        ink: "#1A1625",
        purple: "#7B6CF6",
        yellow: "#FFCE3A",
        mint: "#4FD8A6",
        coral: "#FF7A66",
        blush: "#FF9D8A",
        // App (dark / terminal)
        page: "#0B0A11",
        topbar: "#0F0E17",
        panel: "#100F19",
        panel2: "#141220",
        line: "#24222F",
        line2: "#2A2838",
        divider: "#1B1926",
        txt: "#E7E4F2",
        dim: "#B7B2C9",
        muted: "#8B879C",
        faint: "#7E7A93",
        faint2: "#6E6A82",
        // Tokens
        usdc: "#3E7BFA",
        ceth: "#8B7FF0",
        filled: "#A99BFF",
      },
      fontFamily: {
        display: ["var(--font-fredoka)", "system-ui", "sans-serif"],
        body: ["var(--font-nunito)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      fontWeight: {
        "400": "400",
        "500": "500",
        "600": "600",
        "700": "700",
        "800": "800",
      },
      borderRadius: {
        sticker: "24px",
        panel: "15px",
      },
      boxShadow: {
        sticker: "6px 6px 0 #1A1625",
        "sticker-sm": "4px 4px 0 #1A1625",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        pop: { from: { transform: "scale(.9)", opacity: "0" }, to: { transform: "scale(1)", opacity: "1" } },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.25" } },
      },
      animation: {
        float: "float 4s ease-in-out infinite",
        marquee: "marquee 22s linear infinite",
        pop: "pop .18s ease-out",
        blink: "blink 1.4s ease-in-out infinite",
        spin: "spin 1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
