import { AnthropicProvider } from "./anthropic-provider";
import { HeuristicProvider } from "./heuristic-provider";
import type { LlmProvider } from "./types";

let cached: LlmProvider | null = null;

/**
 * LLM 제공자를 선택한다. CARE_LLM_PROVIDER 환경변수로 교체한다.
 * 새 제공자를 추가할 때는 LlmProvider만 구현하면 서비스 코드는 바뀌지 않는다.
 */
export function getLlmProvider(): LlmProvider {
  if (cached) return cached;
  const requested = (process.env.CARE_LLM_PROVIDER ?? "heuristic").toLowerCase();

  if (requested === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    cached = new AnthropicProvider();
  } else {
    if (requested === "anthropic") {
      console.warn("[ai] ANTHROPIC_API_KEY가 없어 기본 분석기로 동작합니다.");
    }
    cached = new HeuristicProvider();
  }
  return cached;
}

export type { AiAnalysis, AnalysisInput, LlmProvider, QuestionContext } from "./types";
