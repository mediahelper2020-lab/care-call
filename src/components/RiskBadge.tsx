import { RISK_LABEL } from "@/lib/labels";
import type { RiskLevel } from "@/lib/types";

export type BadgeStatus = RiskLevel | "no_answer" | "pending";

const STYLES: Record<BadgeStatus, string> = {
  normal: "bg-safe-50 text-safe-700 border-safe-500/30",
  attention: "bg-watch-50 text-watch-700 border-watch-500/40",
  urgent: "bg-alert-50 text-alert-700 border-alert-500/40",
  no_answer: "bg-ink-100 text-ink-600 border-ink-300",
  pending: "bg-white text-ink-500 border-ink-200",
};

const LABELS: Record<BadgeStatus, string> = {
  ...RISK_LABEL,
  no_answer: "미응답",
  pending: "통화 예정",
};

export function RiskBadge({ status, size = "md" }: { status: BadgeStatus; size?: "sm" | "md" }) {
  const padding = size === "sm" ? "px-2 py-0.5 text-sm" : "px-3 py-1 text-base";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${padding} ${STYLES[status]}`}
    >
      {status === "urgent" ? <span aria-hidden>●</span> : null}
      {LABELS[status]}
    </span>
  );
}
