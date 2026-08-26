import type { CategoryFinding, RiskLevel, SignalCategory, TranscriptTurn } from "../types";

export interface AnalysisInput {
  turns: TranscriptTurn[];
  /** 이전 통화 요약. 문맥 참고용. */
  previousSummaries: string[];
}

export interface AnalyzedSignal {
  category: SignalCategory;
  detected_text: string;
  risk_level: RiskLevel;
  ai_reason: string;
}

export interface AiAnalysis {
  summary: string;
  overall: RiskLevel;
  categories: CategoryFinding[];
  signals: AnalyzedSignal[];
}

export interface QuestionContext {
  clientName: string;
  /** 이미 물어본 주제 */
  askedCategories: SignalCategory[];
  /** 이미 한 번 되물은 주제. 같은 주제를 반복해서 캐묻지 않기 위해 쓴다. */
  followedUpCategories: SignalCategory[];
  lastClientUtterance: string | null;
  previousSummaries: string[];
}

/**
 * LLM 어댑터. 구현체를 교체해도 서비스 코드는 바뀌지 않는다.
 * 기본 구현은 외부 API 없이 동작하는 규칙·휴리스틱 기반이다.
 */
export interface LlmProvider {
  readonly name: string;
  /** 통화 전문을 문맥 분석하여 요약·위험도·카테고리 판정을 만든다. */
  analyzeCall(input: AnalysisInput): Promise<AiAnalysis>;
  /** 다음에 이어갈 안부 질문을 만든다. */
  nextQuestion(
    context: QuestionContext,
  ): Promise<{ text: string; category: SignalCategory | null; isFollowUp: boolean }>;
}
