import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
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
          background: "transparent",
        }}
      >
        <img
          src={`data:image/png;base64,${base64}`}
          width="512"
          height="512"
          alt=""
        />
      </div>
    ),
    { ...size },
  );
}
