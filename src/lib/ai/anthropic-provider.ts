import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORY_LABEL, TREND_CATEGORIES } from "../labels";
import type { CategoryFinding, SignalCategory } from "../types";
import { heuristicAnalyze } from "./heuristic";
import { pickNextQuestion } from "./questions";
import type { AiAnalysis, AnalysisInput, LlmProvider, QuestionContext } from "./types";

const CATEGORY_ENUM = TREND_CATEGORIES as [SignalCategory, ...SignalCategory[]];

const AnalysisSchema = z.object({
  summary: z
    .string()
    .describe("사회복지사가 읽을 3문장 이내의 한국어 요약. 의료적 진단이나 치료 지시는 쓰지 않는다."),
  overall: z.enum(["normal", "attention", "urgent"]),
  categories: z.array(
    z.object({
      category: z.enum(CATEGORY_ENUM),
      level: z.enum(["normal", "attention", "urgent"]),
      note: z.string().describe("한 문장 근거. 특이사항이 없으면 '특이사항 없음'."),
    }),
  ),
  signals: z.array(
    z.object({
      category: z.enum(CATEGORY_ENUM),
      detected_text: z.string().describe("근거가 된 대상자 발화를 그대로 인용"),
      risk_level: z.enum(["attention", "urgent"]),
      ai_reason: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = [
  "당신은 독거노인 안부전화 기록을 검토하는 돌봄 모니터링 보조 시스템입니다.",
  "역할은 통화 내용을 요약하고 담당 사회복지사가 확인해야 할 신호를 정리하는 것입니다.",
  "지켜야 할 규칙:",
  "1. 의료적 진단명이나 치료·복약 지시를 절대 쓰지 않습니다.",
  "2. 긴급상황을 단독으로 확정하지 않습니다. 낙상·심각한 신체 이상·즉각적 도움 요청처럼 사람이 빨리 확인해야 하는 신호는 overall을 urgent로 표시하되, 표현은 '확인이 필요한 신호'로 씁니다.",
  "3. 근거 없는 추측을 하지 않습니다. detected_text에는 대상자가 실제로 말한 문장만 인용합니다.",
  "4. 위험 신호가 없으면 signals를 빈 배열로 두고 overall은 normal로 둡니다.",
  `5. category는 다음 중 하나입니다: ${TREND_CATEGORIES.map((c) => `${c}(${CATEGORY_LABEL[c]})`).join(", ")}`,
].join("\n");

/**
 * Anthropic Messages API 어댑터.
 * CARE_LLM_PROVIDER=anthropic 이고 ANTHROPIC_API_KEY가 있을 때만 선택된다.
 * 호출이 실패하면 규칙·휴리스틱 분석으로 안전하게 내려간다.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic();
    this.model = process.env.CARE_LLM_MODEL ?? "claude-opus-5";
  }

  async analyzeCall(input: AnalysisInput): Promise<AiAnalysis> {
    const fallback = heuristicAnalyze(input.turns, input.previousSummaries);
    const transcript = input.turns
      .map((t) => `${t.speaker === "ai" ? "AI" : "대상자"}: ${t.text}`)
      .join("\n");
    const history =
      input.previousSummaries.length > 0
        ? `\n\n[이전 통화 요약]\n${input.previousSummaries.slice(0, 5).join("\n")}`
        : "";

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `[오늘 통화 전문]\n${transcript}${history}` }],
        output_config: { format: zodOutputFormat(AnalysisSchema) },
      });
      const parsed = response.parsed_output;
      if (!parsed) return fallback;
      return {
        summary: parsed.summary,
        overall: parsed.overall,
        categories: parsed.categories as CategoryFinding[],
        signals: parsed.signals,
      };
    } catch (error) {
      console.error("[ai] Anthropic 분석 실패, 규칙 기반 결과로 대체합니다.", error);
      return fallback;
    }
  }

  async nextQuestion(context: QuestionContext) {
    return pickNextQuestion(context);
  }
}
