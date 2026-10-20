import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { Sentiment } from "@/lib/api-client";

const MAP: Record<Sentiment, { label: string; variant: BadgeVariant }> = {
  positive: { label: "Leans positive", variant: "positive" },
  negative: { label: "Leans negative", variant: "negative" },
  mixed: { label: "Mixed", variant: "warning" },
  unclear: { label: "Unclear", variant: "neutral" },
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment | string }) {
  const m = MAP[sentiment as Sentiment] ?? MAP.unclear;
  return <Badge variant={m.variant} dot>{m.label}</Badge>;
}
