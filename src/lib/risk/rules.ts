import type { RiskLevel, SignalCategory } from "../types";

export interface RuleHit {
  ruleId: string;
  category: SignalCategory;
  level: RiskLevel;
  keyword: string;
  detected_text: string;
  reason: string;
}

interface Rule {
  id: string;
  category: SignalCategory;
  level: RiskLevel;
  /** 하나라도 포함되면 후보가 된다. */
  keywords: string[];
  /** 이 중 하나라도 포함되면 무시한다(부정 표현 등). */
  negations?: string[];
  reason: string;
}

/**
 * 규칙 기반 탐지표.
 * AI 문맥 분석과 함께 하이브리드로 사용하며, 규칙이 잡은 긴급 신호는
 * AI 판단과 무관하게 항상 '긴급 확인'으로 올린다.
 */
const RULES: Rule[] = [
  {
    id: "fall",
    category: "physical",
    level: "urgent",
    keywords: ["넘어졌", "넘어져", "미끄러졌", "낙상", "쓰러졌", "주저앉", "굴렀"],
    negations: ["안 넘어졌", "넘어질 뻔", "넘어지지 않았"],
    reason: "낙상 관련 표현이 감지되었습니다.",
  },
  {
    id: "immediate_help",
    category: "help_request",
    level: "urgent",
    keywords: ["도와주세요", "도움이 필요해", "지금 도움", "구급차", "119", "못 일어나", "일어날 수가 없"],
    reason: "즉각적인 도움이 필요하다는 취지의 발언이 감지되었습니다.",
  },
  {
    id: "severe_symptom",
    category: "physical",
    level: "urgent",
    keywords: [
      "숨이 안",
      "숨쉬기 힘들",
      "숨이 차서",
      "가슴이 답답",
      "가슴이 아파",
      "피가 나",
      "의식",
      "말이 잘 안 나와",
      "한쪽이 안 움직",
      "마비",
    ],
    reason: "심각한 신체 이상을 시사하는 표현이 감지되었습니다.",
  },
  {
    id: "meal_skipped",
    category: "meal",
    level: "attention",
    keywords: ["못 먹었", "안 먹었", "굶", "입맛이 없", "식사를 못", "먹을 게 없", "밥 생각이 없"],
    negations: ["잘 먹었", "다 먹었"],
    reason: "식사를 제대로 하지 못한 정황이 확인되었습니다.",
  },
  {
    id: "pain",
    category: "physical",
    level: "attention",
    keywords: ["아파", "아프", "쑤셔", "결려", "저려", "통증", "불편해", "붓", "어지러"],
    negations: ["안 아파", "아프지 않"],
    reason: "지속적인 통증이나 불편감 언급이 확인되었습니다.",
  },
  {
    id: "medication_issue",
    category: "medication",
    level: "attention",
    keywords: ["약을 못", "약 안 먹", "약이 떨어졌", "약을 깜빡", "약 챙기기", "약이 없어"],
    negations: ["약은 잘", "약 잘 챙겨"],
    reason: "복약 관련 어려움이 언급되었습니다.",
  },
  {
    id: "sleep_issue",
    category: "sleep",
    level: "attention",
    keywords: ["잠을 못", "못 잤", "잠이 안", "밤새", "자다 깨", "뒤척"],
    negations: ["잘 잤", "푹 잤"],
    reason: "수면에 어려움이 있다는 표현이 확인되었습니다.",
  },
  {
    id: "emotional",
    category: "emotional",
    level: "attention",
    keywords: ["외로", "우울", "쓸쓸", "사는 게 힘들", "눈물", "허전", "무서워", "불안"],
    reason: "정서적 어려움을 시사하는 표현이 확인되었습니다.",
  },
  {
    id: "isolation",
    category: "social",
    level: "attention",
    keywords: ["아무도 안 와", "찾아오는 사람이 없", "연락이 없", "혼자 있", "말할 사람이 없"],
    reason: "사회적 고립이 의심되는 표현이 확인되었습니다.",
  },
  {
    id: "no_outing",
    category: "outing",
    level: "attention",
    keywords: ["나가지 못", "못 나갔", "밖에 못", "집에만 있", "외출을 못"],
    reason: "외출이 어려운 상태가 언급되었습니다.",
  },
  {
    id: "help_needed",
    category: "help_request",
    level: "attention",
    keywords: ["부탁하고 싶", "좀 와줬으면", "필요한 게 있", "해결이 안 돼", "도움 좀"],
    reason: "도움이 필요하다는 표현이 확인되었습니다.",
  },
];

/** 긍정 응답을 인식해 해당 항목을 '정상'으로 기록하기 위한 표. */
const POSITIVE_MARKERS: { category: SignalCategory; keywords: string[]; note: string }[] = [
  {
    category: "meal",
    // '약은 챙겨 먹었어요'가 식사 응답으로 잡히지 않도록 끼니를 가리키는 표현만 둔다.
    keywords: ["잘 먹었", "밥 먹었", "밥은 먹었", "다 먹었", "밥 챙겨", "끼니", "식사했", "해 먹었"],
    note: "식사했다고 응답함",
  },
  { category: "sleep", keywords: ["잘 잤", "푹 잤", "잘 잤어", "괜찮게 잤"], note: "수면상태는 평소와 비슷함" },
  { category: "medication", keywords: ["약은 잘", "약 잘 챙겨", "약 먹었", "챙겨 먹었"], note: "복약은 평소대로 했다고 응답함" },
  { category: "physical", keywords: ["괜찮아", "아픈 데 없", "별일 없", "멀쩡"], note: "특별한 신체 이상 언급 없음" },
  { category: "emotional", keywords: ["기분 좋", "괜찮아", "즐거", "편안"], note: "정서상태 특이사항 없음" },
  { category: "social", keywords: ["딸이 왔", "아들이 왔", "친구랑", "경로당", "복지관"], note: "주변과 교류가 확인됨" },
  { category: "outing", keywords: ["산책", "나갔다 왔", "장 보러", "마실"], note: "외출 활동이 확인됨" },
];

export interface PositiveHit {
  category: SignalCategory;
  note: string;
}

function containsAny(text: string, list: string[]): string | null {
  for (const k of list) {
    if (text.includes(k)) return k;
  }
  return null;
}

/** 대상자 발화에서 규칙 기반 위험 신호를 찾는다. 동기·결정적으로 동작한다. */
export function detectRuleSignals(clientUtterances: string[]): RuleHit[] {
  const hits: RuleHit[] = [];
  const seen = new Set<string>();
  for (const utterance of clientUtterances) {
    const text = utterance.replace(/\s+/g, " ");
    for (const rule of RULES) {
      if (rule.negations && containsAny(text, rule.negations)) continue;
      const keyword = containsAny(text, rule.keywords);
      if (!keyword) continue;
      if (seen.has(rule.id)) continue;
      seen.add(rule.id);
      hits.push({
        ruleId: rule.id,
        category: rule.category,
        level: rule.level,
        keyword,
        detected_text: utterance.trim(),
        reason: rule.reason,
      });
    }
  }
  return hits;
}

export function detectPositiveSignals(clientUtterances: string[]): PositiveHit[] {
  const hits: PositiveHit[] = [];
  const seen = new Set<SignalCategory>();
  for (const utterance of clientUtterances) {
    for (const marker of POSITIVE_MARKERS) {
      if (seen.has(marker.category)) continue;
      if (containsAny(utterance, marker.keywords)) {
        seen.add(marker.category);
        hits.push({ category: marker.category, note: marker.note });
      }
    }
  }
  return hits;
}

/** 무응답·회피가 반복되는지 확인한다. */
export function detectNonResponse(clientUtterances: string[]): boolean {
  if (clientUtterances.length === 0) return true;
  const vague = clientUtterances.filter((u) => {
    const t = u.trim();
    return t.length <= 3 || ["...", "글쎄", "몰라", "네", "음"].some((v) => t === v);
  });
  return vague.length >= 2 && vague.length >= clientUtterances.length / 2;
}
