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
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 88,
          background: "#d4d4d8",
          fontFamily: "Lexend",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontSize: 180,
            fontWeight: 400,
            letterSpacing: "-0.04em",
          }}
        >
          <span style={{ color: "#c026d3" }}>V</span>
          <span style={{ color: "#2563eb" }}>S</span>
        </span>
      </div>
    ),
    {
      width: 400,
      height: 400,
      fonts: [{ name: "Lexend", data: fontData, weight: 400, style: "normal" }],
    }
  );
}
