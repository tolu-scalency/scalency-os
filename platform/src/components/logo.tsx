/* eslint-disable @next/next/no-img-element */
// Tolu's Scalency logo with the "OS" tag. "color" is for white backgrounds, "white" for the blue sidebar.
export function Logo({ variant = "color", height = 26 }: { variant?: "color" | "white"; height?: number }) {
  const src = variant === "white" ? "/brand/wordmark-white.png" : "/brand/wordmark.png";
  return (
    <span className="inline-flex items-center gap-2">
      <img src={src} alt="Scalency" width={Math.round(height * 3.93)} height={height} style={{ height, width: "auto" }} />
      <span
        className={`rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold tracking-wider ${
          variant === "white" ? "bg-white/20 text-white" : "bg-chip text-brand"
        }`}
      >
        OS
      </span>
    </span>
  );
}
