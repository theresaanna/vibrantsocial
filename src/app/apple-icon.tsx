import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "22%",
          background: "linear-gradient(135deg, #c026d3 0%, #2563eb 100%)",
        }}
      >
        <span
          style={{
            fontSize: 100,
            fontWeight: 700,
            color: "white",
            letterSpacing: "-0.05em",
          }}
        >
          VS
        </span>
      </div>
    ),
    { ...size },
  );
}
