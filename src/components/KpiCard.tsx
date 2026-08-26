const TONES = {
  neutral: "border-ink-200 bg-white",
  brand: "border-brand-100 bg-brand-50",
  safe: "border-safe-500/25 bg-safe-50",
  watch: "border-watch-500/30 bg-watch-50",
  alert: "border-alert-500/30 bg-alert-50",
} as const;

const VALUE_TONES = {
  neutral: "text-ink-900",
  brand: "text-brand-700",
  safe: "text-safe-700",
  watch: "text-watch-700",
  alert: "text-alert-700",
} as const;

export function KpiCard({
  label,
  value,
  unit,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number;
  unit: string;
  tone?: keyof typeof TONES;
  hint?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${TONES[tone]}`}>
      <p className="text-sm font-bold text-ink-600 sm:text-base">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl ${VALUE_TONES[tone]}`}>
        {value}
        <span className="ml-1 text-lg font-bold sm:text-xl">{unit}</span>
      </p>
      {hint ? <p className="mt-1 text-sm text-ink-500">{hint}</p> : null}
    </div>
  );
}
