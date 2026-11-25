/* eslint-disable @next/next/no-img-element */
// Tolu's Scalency logo. "color" is for white backgrounds, "white" for the blue sidebar.
export function Logo({ variant = "color", height = 26 }: { variant?: "color" | "white"; height?: number }) {
  const src = variant === "white" ? "/brand/wordmark-white.png" : "/brand/wordmark.png";
  return (
    <span className="inline-flex items-center gap-2">
      <img src={src} alt="Scalency" width={Math.round(height * 3.93)} height={height} style={{ height, width: "auto" }} />
    </span>
  );
}
