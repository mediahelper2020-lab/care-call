import { heuristicAnalyze } from "./heuristic";
import { pickNextQuestion } from "./questions";
import type { AiAnalysis, AnalysisInput, LlmProvider, QuestionContext } from "./types";

/**
 * 외부 API 없이 동작하는 기본 제공자.
 * LLM 키가 없어도 서비스 전체 흐름이 그대로 동작하도록 한다.
 */
export class HeuristicProvider implements LlmProvider {
  readonly name = "heuristic";

  async analyzeCall(input: AnalysisInput): Promise<AiAnalysis> {
    return heuristicAnalyze(input.turns, input.previousSummaries);
  }

  async nextQuestion(context: QuestionContext) {
    return pickNextQuestion(context);
  }
}
