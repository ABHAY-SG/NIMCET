import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NimCuet — NIMCET & CUET PG MCA Mock Tests",
    short_name: "NimCuet",
    description: "Premium mock tests for NIMCET and CUET PG MCA — real marking, real timers, honest analytics.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#635bdb",
    icons: [
      { src: "/logo.png", sizes: "any", type: "image/png" },
    ],
  };
}
