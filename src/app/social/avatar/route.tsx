import { ImageResponse } from "next/og";

export async function GET() {
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
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="340"
          height="340"
        >
          {/* Blue heart */}
          <path
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            fill="#2563eb"
          />
          {/* Magenta hashtag centered inside the heart */}
          <path
            d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5"
            fill="none"
            stroke="#c026d3"
            stroke-width="3.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            transform="translate(5.4, 3.9) scale(0.55)"
          />
        </svg>
      </div>
    ),
    {
      width: 400,
      height: 400,
    }
  );
}
