import { detectRuleSignals } from "../risk/rules";
import type { SignalCategory } from "../types";
import type { QuestionContext } from "./types";

interface QuestionTemplate {
  category: SignalCategory;
  variants: string[];
}

/**
 * 짧고 이해하기 쉬운 문장으로 구성한 안부 질문.
 * 의료적 진단이나 치료 지시에 해당하는 표현은 넣지 않는다.
 */
const QUESTIONS: QuestionTemplate[] = [
  {
    category: "meal",
    variants: [
      "오늘 식사는 하셨나요?",
      "오늘 끼니는 잘 챙기셨어요?",
      "오늘은 무엇을 드셨어요?",
    ],
  },
  {
    category: "sleep",
    variants: ["밤에는 잘 주무셨어요?", "어젯밤 잠자리는 편안하셨어요?"],
  },
  {
    category: "physical",
    variants: [
      "오늘 몸이 불편한 곳은 있으세요?",
      "오늘 컨디션은 어떠세요?",
      "오늘 넘어지거나 다친 일은 없으셨나요?",
    ],
  },
  {
    category: "medication",
    variants: ["약은 평소처럼 챙겨 드셨나요?", "드시는 약은 잘 챙기고 계세요?"],
  },
  {
    category: "emotional",
    variants: ["오늘 기분은 어떠세요?", "요즘 마음은 편안하세요?"],
  },
  {
    category: "social",
    variants: ["요즘 가족이나 이웃과는 자주 이야기 나누세요?", "오늘 누구와 이야기 나누셨어요?"],
  },
  {
    category: "outing",
    variants: ["오늘은 밖에 나가셨어요?", "요즘 바깥 활동은 어떠세요?"],
  },
  {
    category: "help_request",
    variants: ["지금 도움이 필요한 일이 있으세요?", "제가 담당 선생님께 전해드릴 말씀 있으세요?"],
  },
];

/** 직전 응답에 신호가 있으면 같은 주제를 자연스럽게 이어 묻는다. */
const FOLLOW_UPS: Partial<Record<SignalCategory, string>> = {
  meal: "식사를 못 하신 지는 얼마나 되셨어요?",
  sleep: "잠을 설치신 지는 며칠 되셨어요?",
  medication: "약 챙기시는 게 어떤 점이 어려우세요?",
  physical: "지금은 어느 정도로 불편하세요?",
  emotional: "어떤 일 때문에 그런 마음이 드셨어요?",
  social: "요즘 누구와 이야기 나누기가 어려우세요?",
  outing: "밖에 나가시기 어려운 이유가 있으세요?",
  help_request: "어떤 도움이 필요하신지 조금 더 말씀해 주시겠어요?",
};

/** 긴급 신호 직후에는 상태 확인과 안내만 한다. 진단이나 처치 지시는 하지 않는다. */
const URGENT_FOLLOW_UP = "많이 놀라셨겠어요. 지금 움직이기 어려우신가요? 담당 선생님께 바로 알려드릴게요.";

export const GREETING = (clientName: string) =>
  `안녕하세요, ${clientName} 어르신. AI 안심돌봄입니다. 오늘 안부 여쭈려고 전화드렸어요.`;

export const CLOSING = "말씀 잘 들었어요. 오늘도 편안한 하루 보내세요. 다음에 또 연락드릴게요.";

function pickVariant(variants: string[], seed: number): string {
  return variants[seed % variants.length];
}

/**
 * 이전 응답과 이미 물어본 항목을 참고해 다음 질문을 고른다.
 * 같은 질문을 기계적으로 반복하지 않도록 이전 통화 요약도 함께 본다.
 */
export function pickNextQuestion(context: QuestionContext): {
  text: string;
  category: SignalCategory | null;
  isFollowUp: boolean;
} {
  if (context.lastClientUtterance) {
    const hits = detectRuleSignals([context.lastClientUtterance]);
    const urgent = hits.find((h) => !context.followedUpCategories.includes(h.category) && h.level === "urgent");
    if (urgent) return { text: URGENT_FOLLOW_UP, category: urgent.category, isFollowUp: true };
    const attention = hits.find(
      (h) => FOLLOW_UPS[h.category] && !context.followedUpCategories.includes(h.category),
    );
    if (attention) {
      return {
        text: FOLLOW_UPS[attention.category] as string,
        category: attention.category,
        isFollowUp: true,
      };
    }
  }

  const remaining = QUESTIONS.filter((q) => !context.askedCategories.includes(q.category));
  if (remaining.length === 0) return { text: CLOSING, category: null, isFollowUp: false };

  const seed = context.previousSummaries.length + context.askedCategories.length;
  const next = remaining[0];
  return { text: pickVariant(next.variants, seed), category: next.category, isFollowUp: false };
}

export function questionCategories(): SignalCategory[] {
  return QUESTIONS.map((q) => q.category);
}
