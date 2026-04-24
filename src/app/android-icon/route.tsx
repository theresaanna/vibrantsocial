import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
  const data = await readFile(join(process.cwd(), "public/icon-512.png"));
  const base64 = data.toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
        }}
      >
        <img
          src={`data:image/png;base64,${base64}`}
          width="460"
          height="460"
          alt=""
        />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
