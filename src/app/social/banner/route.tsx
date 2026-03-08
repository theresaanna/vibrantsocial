import { ImageResponse } from "next/og";

async function loadLexend() {
  const css = await fetch(
    "https://fonts.googleapis.com/css2?family=Lexend:wght@400"
  ).then((r) => r.text());
  const url = css.match(/url\(([^)]+)\)/)?.[1];
  if (!url) throw new Error("Lexend font URL not found");
  return fetch(url).then((r) => r.arrayBuffer());
}

export async function GET() {
  const fontData = await loadLexend();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#18181b",
          fontFamily: "Lexend",
        }}
      >
        <span
          style={{
            fontSize: 72,
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          <span style={{ color: "#c026d3" }}>Vibrant</span>
          <span style={{ color: "#2563eb" }}>Social</span>
        </span>
        <div
          style={{
            width: 400,
            height: 3,
            borderRadius: 2,
            background: "linear-gradient(to right, #c026d3, #2563eb)",
            marginTop: 20,
            opacity: 0.8,
          }}
        />
      </div>
    ),
    {
      width: 1500,
      height: 500,
      fonts: [{ name: "Lexend", data: fontData, weight: 400, style: "normal" }],
    }
  );
}
