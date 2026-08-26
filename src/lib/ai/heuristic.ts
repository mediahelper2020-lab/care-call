import { detectNonResponse, detectPositiveSignals, detectRuleSignals } from "../risk/rules";
import { CATEGORY_LABEL, DETAIL_CATEGORIES } from "../labels";
import type { CategoryFinding, RiskLevel, SignalCategory, TranscriptTurn } from "../types";
import type { AiAnalysis, AnalyzedSignal } from "./types";

function worst(a: RiskLevel, b: RiskLevel): RiskLevel {
  if (a === "urgent" || b === "urgent") return "urgent";
  if (a === "attention" || b === "attention") return "attention";
  return "normal";
}

export function clientUtterances(turns: TranscriptTurn[]): string[] {
  return turns.filter((t) => t.speaker === "client").map((t) => t.text);
}

/**
 * 외부 API 없이 동작하는 기본 문맥 분석.
 * 규칙 탐지 결과와 긍정 응답 표지를 합쳐 요약문과 카테고리별 판정을 만든다.
 */
export function heuristicAnalyze(turns: TranscriptTurn[], previousSummaries: string[] = []): AiAnalysis {
  const utterances = clientUtterances(turns);
  const ruleHits = detectRuleSignals(utterances);
  const positives = detectPositiveSignals(utterances);
  const nonResponse = detectNonResponse(utterances);

  const signals: AnalyzedSignal[] = ruleHits.map((hit) => ({
    category: hit.category,
    detected_text: hit.detected_text,
    risk_level: hit.level,
    ai_reason: hit.reason,
  }));

  if (nonResponse) {
    signals.push({
      category: "help_request",
      detected_text: utterances.join(" ").slice(0, 60) || "(응답 없음)",
      risk_level: "attention",
      ai_reason: "질문에 대한 응답이 반복적으로 확인되지 않았습니다.",
    });
  }

  const levelByCategory = new Map<SignalCategory, RiskLevel>();
  const noteByCategory = new Map<SignalCategory, string>();

  for (const positive of positives) {
    levelByCategory.set(positive.category, "normal");
    noteByCategory.set(positive.category, positive.note);
  }
  for (const signal of signals) {
    const current = levelByCategory.get(signal.category) ?? "normal";
    const next = worst(current, signal.risk_level);
    levelByCategory.set(signal.category, next);
    if (next === signal.risk_level) noteByCategory.set(signal.category, signal.ai_reason);
  }

  const categories: CategoryFinding[] = DETAIL_CATEGORIES.map((category) => ({
    category,
    level: levelByCategory.get(category) ?? "normal",
    note: noteByCategory.get(category) ?? "특이사항 없음",
  }));
  for (const [category, level] of levelByCategory) {
    if (DETAIL_CATEGORIES.includes(category)) continue;
    categories.push({ category, level, note: noteByCategory.get(category) ?? "특이사항 없음" });
  }

  const overall = signals.reduce<RiskLevel>((acc, s) => worst(acc, s.risk_level), "normal");
  const previousHint = previousContextHint(previousSummaries, signals);
  // 같은 항목에서 위험 신호가 잡혔다면 긍정 응답 문장은 요약에서 뺀다.
  const flagged = new Set(signals.map((s) => s.category));
  const summary = buildSummary(
    positives.filter((p) => !flagged.has(p.category)).map((p) => p.note),
    signals,
    nonResponse,
    previousHint,
  );

  return { summary, overall, categories, signals };
}

function previousContextHint(previousSummaries: string[], signals: AnalyzedSignal[]): string | null {
  if (previousSummaries.length === 0 || signals.length === 0) return null;
  const recent = previousSummaries.slice(0, 3).join(" ");
  const repeated = signals.find((s) => recent.includes(CATEGORY_LABEL[s.category]));
  if (!repeated) return null;
  return `${CATEGORY_LABEL[repeated.category]} 관련 언급은 이전 통화에서도 확인된 내용임.`;
}

function buildSummary(
  positiveNotes: string[],
  signals: AnalyzedSignal[],
  nonResponse: boolean,
  previousHint: string | null,
): string {
  const parts: string[] = [];
  for (const note of positiveNotes.slice(0, 3)) parts.push(`${note}.`);

  const urgent = signals.filter((s) => s.risk_level === "urgent");
  const attention = signals.filter((s) => s.risk_level === "attention");

  const quoted = new Set<string>();
  for (const signal of urgent) {
    const quote = trim(signal.detected_text);
    if (quoted.has(quote)) continue;
    quoted.add(quote);
    parts.push(`"${quote}" 취지의 발언이 확인되어 담당자 확인이 필요함.`);
  }

  const mentioned = new Set<string>();
  for (const signal of attention) {
    if (mentioned.has(signal.ai_reason)) continue;
    mentioned.add(signal.ai_reason);
    parts.push(signal.ai_reason);
    if (mentioned.size >= 3) break;
  }
  if (nonResponse) parts.push("질문에 대한 응답이 충분히 확인되지 않음.");
  if (previousHint) parts.push(previousHint);
  if (parts.length === 0) parts.push("전반적으로 평소와 비슷한 상태로 응답함. 특이사항 없음.");
  return parts.join(" ");
}

function trim(text: string): string {
  const clean = text.trim();
  return clean.length > 40 ? `${clean.slice(0, 40)}…` : clean;
}
