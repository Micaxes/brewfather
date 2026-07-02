/** Brewable wordmark: the amber gradient beer glyph + "Brewable" in the display font. */
export function Logo({
  size = "md",
  showWordmark = true,
}: {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}) {
  const box = size === "lg" ? 44 : size === "sm" ? 34 : 38;
  const glyph = Math.round(box * 0.52);
  const radius = size === "lg" ? 14 : 12;
  const text = size === "lg" ? "text-[26px]" : size === "sm" ? "text-lg" : "text-xl";

  return (
    <div className="flex items-center gap-3">
      <div
        className="brand-gradient flex items-center justify-center"
        style={{ width: box, height: box, borderRadius: radius }}
        aria-hidden="true"
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#08121a"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z" />
          <path d="M16 9h2.5a2.5 2.5 0 0 1 0 5H16" />
          <path d="M8 2.5c-.6 1 .6 1.6 0 2.6M11.5 2.5c-.6 1 .6 1.6 0 2.6" />
        </svg>
      </div>
      {showWordmark ? (
        <span
          className={`font-display font-bold tracking-[-0.02em] ${text}`}
        >
          Brewable
        </span>
      ) : null}
    </div>
  );
}
