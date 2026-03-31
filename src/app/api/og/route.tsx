import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

export function GET() {
  const logoData = readFileSync(
    join(process.cwd(), "public/vibrantsocial-logo.png")
  );
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          padding: "60px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={620}
          height={75}
          alt="VibrantSocial"
          style={{ marginBottom: 36 }}
        />
        <p
          style={{
            color: "#71717a",
            fontSize: 28,
            fontFamily: "sans-serif",
            textAlign: "center",
            margin: 0,
            maxWidth: 700,
            lineHeight: 1.5,
          }}
        >
          Social media for adults. No algorithms, no AI nonsense.
        </p>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
