import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VibrantSocial",
    short_name: "VibrantSocial",
    description: "Connect and share with VibrantSocial",
    start_url: "/feed",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c026d3",
    icons: [
      {
        src: "/android-icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
