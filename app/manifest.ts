import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hôm nay ăn gì? – Vietnamese food wheel",
    short_name: "Ăn gì?",
    description: "Spin the wheel to pick a Vietnamese dish and find great places nearby.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff7ec",
    theme_color: "#fff7ec",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
