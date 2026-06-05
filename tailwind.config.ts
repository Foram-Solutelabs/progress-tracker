import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "var(--ink)", raised: "var(--ink-2)" },
        surface: { DEFAULT: "var(--surface)", raised: "var(--surface-2)" },
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        bone: "var(--bone)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        amber: { DEFAULT: "var(--amber)", bright: "var(--amber-bright)", deep: "var(--amber-deep)" },
        sage: "var(--sage)",
        rust: "var(--rust)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
