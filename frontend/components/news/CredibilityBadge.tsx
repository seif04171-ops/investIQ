import clsx from "clsx";

export function credibilityTone(score: number) {
  if (score >= 80) return { label: "High", text: "text-positive", bar: "bg-positive" };
  if (score >= 55) return { label: "Moderate", text: "text-primary", bar: "bg-primary" };
  return { label: "Low", text: "text-negative", bar: "bg-negative" };
}

/**
 * Credibility as a five-segment meter + number. `label` adds the word
 * (High / Moderate / Low) so colour is never the only signal.
 */
export function CredibilityBadge({
  score,
  label = false,
  className,
}: {
  score: number | null;
  label?: boolean;
  className?: string;
}) {
  if (score === null) {
    return <span className="text-xs text-dim">Not yet scored</span>;
  }
  const tone = credibilityTone(score);
  const filled = Math.max(1, Math.round(score / 20));
  return (
    <span
      className={clsx("inline-flex items-center gap-2 text-xs", className)}
      title={`Credibility ${score}/100 — based on source reputation, independent confirmations and official confirmation`}
    >
      <span className="flex items-end gap-[3px]" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{ height: 6 + i * 2 }}
            className={clsx("w-[3px] rounded-full", i < filled ? tone.bar : "bg-white/10")}
          />
        ))}
      </span>
      <span className={clsx("num font-semibold", tone.text)}>{score}</span>
      {label && <span className="text-muted">{tone.label} credibility</span>}
    </span>
  );
}
