import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          background: "#18181b",
        }}
      >
        <span
          style={{
            fontSize: 280,
            fontWeight: 700,
            letterSpacing: "-0.05em",
          }}
        >
          <span style={{ color: "#c026d3" }}>V</span>
          <span style={{ color: "#2563eb" }}>S</span>
        </span>
      </div>
    ),
    { ...size },
  );
}
