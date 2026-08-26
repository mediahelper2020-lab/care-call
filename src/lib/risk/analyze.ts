import { getLlmProvider } from "../ai";
import { clientUtterances } from "../ai/heuristic";
import { DETAIL_CATEGORIES } from "../labels";
import type { CategoryFinding, RiskLevel, SignalCategory, TranscriptTurn } from "../types";
import { detectNonResponse, detectRuleSignals } from "./rules";

export interface HybridSignal {
  category: SignalCategory;
  detected_text: string;
  risk_level: RiskLevel;
  ai_reason: string;
  source: "rule" | "ai";
}

export interface HybridResult {
  summary: string;
  overall: RiskLevel;
  categories: CategoryFinding[];
  signals: HybridSignal[];
  decided_by: "rule" | "ai" | "both" | "none";
  provider: string;
}

function worst(a: RiskLevel, b: RiskLevel): RiskLevel {
  if (a === "urgent" || b === "urgent") return "urgent";
  if (a === "attention" || b === "attention") return "attention";
  return "normal";
}

/**
 * 규칙 기반 탐지와 AI 문맥 분석을 함께 사용하는 하이브리드 위험도 분석.
 * 규칙이 잡은 신호는 AI 판단과 무관하게 항상 유지된다.
 */
export async function analyzeTranscript(
  turns: TranscriptTurn[],
  previousSummaries: string[] = [],
): Promise<HybridResult> {
  const provider = getLlmProvider();
  const utterances = clientUtterances(turns);

  const ruleHits = detectRuleSignals(utterances);
  const ruleOverall = ruleHits.reduce<RiskLevel>((acc, h) => worst(acc, h.level), "normal");

  const ai = await provider.analyzeCall({ turns, previousSummaries });

  const signals: HybridSignal[] = ruleHits.map((hit) => ({
    category: hit.category,
    detected_text: hit.detected_text,
    risk_level: hit.level,
    ai_reason: hit.reason,
    source: "rule" as const,
  }));

  const ruleKeys = new Set(signals.map((s) => `${s.category}|${s.detected_text}`));
  let aiOnlyCount = 0;
  for (const signal of ai.signals) {
    const key = `${signal.category}|${signal.detected_text}`;
    if (ruleKeys.has(key)) continue;
    if (signals.some((s) => s.category === signal.category && s.risk_level === signal.risk_level)) {
      continue;
    }
    aiOnlyCount += 1;
    signals.push({ ...signal, source: "ai" });
  }

  if (detectNonResponse(utterances) && !signals.some((s) => s.category === "help_request")) {
    signals.push({
      category: "help_request",
      detected_text: "(응답이 충분히 확인되지 않음)",
      risk_level: "attention",
      ai_reason: "질문에 대한 응답이 반복적으로 확인되지 않았습니다.",
      source: "rule",
    });
  }

  const overall = worst(ruleOverall, ai.overall);
  const categories = mergeCategories(ai.categories, signals);

  let decided_by: HybridResult["decided_by"] = "none";
  if (ruleHits.length > 0 && aiOnlyCount > 0) decided_by = "both";
  else if (ruleHits.length > 0) decided_by = "rule";
  else if (aiOnlyCount > 0) decided_by = "ai";

  return { summary: ai.summary, overall, categories, signals, decided_by, provider: provider.name };
}

function mergeCategories(aiCategories: CategoryFinding[], signals: HybridSignal[]): CategoryFinding[] {
  const map = new Map<SignalCategory, CategoryFinding>();
  for (const category of DETAIL_CATEGORIES) {
    map.set(category, { category, level: "normal", note: "특이사항 없음" });
  }
  for (const finding of aiCategories) {
    map.set(finding.category, { ...finding });
  }
  for (const signal of signals) {
    const current = map.get(signal.category) ?? {
      category: signal.category,
      level: "normal" as RiskLevel,
      note: "특이사항 없음",
    };
    const level = worst(current.level, signal.risk_level);
    map.set(signal.category, {
      category: signal.category,
      level,
      note: level === signal.risk_level ? signal.ai_reason : current.note,
    });
  }
  const ordered: CategoryFinding[] = [];
  for (const category of DETAIL_CATEGORIES) {
    const found = map.get(category);
    if (found) ordered.push(found);
    map.delete(category);
  }
  for (const finding of map.values()) ordered.push(finding);
  return ordered;
}
