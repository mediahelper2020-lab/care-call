import type { RiskLevel } from "../types";

export interface CallScenario {
  id: string;
  label: string;
  /** 시연 시 보여줄 대표 발언 */
  headline: string;
  /** 예상 위험도. no_answer는 미응답 처리. */
  expected: RiskLevel | "no_answer";
  /** AI 질문에 순서대로 대응하는 대상자 응답 */
  replies: string[];
}

export const SCENARIOS: CallScenario[] = [
  {
    id: "normal",
    label: "정상 시나리오",
    headline: "오늘 밥 잘 먹었어요. 별일 없어요.",
    expected: "normal",
    replies: [
      "오늘 밥 잘 먹었어요. 별일 없어요.",
      "어제는 푹 잤어요.",
      "몸은 괜찮아요. 아픈 데 없어요.",
      "약은 잘 챙겨 먹었어요.",
      "기분 좋아요. 아침에 산책도 다녀왔어요.",
      "고맙습니다. 별일 없어요.",
    ],
  },
  {
    id: "attention",
    label: "확인 필요 시나리오",
    headline: "오늘은 입맛이 없어서 아직 아무것도 못 먹었어요.",
    expected: "attention",
    replies: [
      "오늘은 입맛이 없어서 아직 아무것도 못 먹었어요.",
      "며칠 됐어요. 요새 통 밥 생각이 없네요.",
      "잠은 그럭저럭 잤어요.",
      "무릎이 좀 쑤셔요. 그래서 밖에 못 나갔어요.",
      "약은 잘 챙겨 먹었어요.",
      "괜찮아요. 고마워요.",
    ],
  },
  {
    id: "urgent",
    label: "긴급 확인 시나리오",
    headline: "조금 전에 넘어져서 지금 도움이 필요해요.",
    expected: "urgent",
    replies: [
      "조금 전에 넘어져서 지금 도움이 필요해요.",
      "화장실 가다가 미끄러졌어요. 일어나기가 힘드네요.",
      "허리가 많이 아파요.",
      "밥은 아직 못 먹었어요.",
      "네, 부탁드려요.",
    ],
  },
  {
    id: "no_answer",
    label: "미응답 시나리오",
    headline: "전화를 받지 않음",
    expected: "no_answer",
    replies: [],
  },
  {
    id: "low_response",
    label: "반복 무응답 시나리오",
    headline: "짧은 응답만 반복됨",
    expected: "attention",
    replies: ["네", "몰라", "...", "글쎄", "네"],
  },
];

export function getScenario(id: string): CallScenario | null {
  return SCENARIOS.find((s) => s.id === id) ?? null;
}
