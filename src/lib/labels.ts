import type {
  CallStatus,
  ConsentStatus,
  InterventionAction,
  RiskLevel,
  SignalCategory,
} from "./types";

export const RISK_LABEL: Record<RiskLevel, string> = {
  normal: "정상",
  attention: "확인 필요",
  urgent: "긴급 확인",
};

export const RISK_ORDER: Record<RiskLevel, number> = {
  urgent: 0,
  attention: 1,
  normal: 2,
};

export const CATEGORY_LABEL: Record<SignalCategory, string> = {
  meal: "식사",
  sleep: "수면",
  medication: "복약",
  physical: "신체상태",
  emotional: "정서상태",
  social: "사회적 관계",
  outing: "외출",
  help_request: "도움 요청",
};

/** 상세 화면 'AI 분석' 표에 이 순서로 노출한다. */
export const DETAIL_CATEGORIES: SignalCategory[] = [
  "meal",
  "sleep",
  "medication",
  "physical",
  "emotional",
];

/** 추이 분석 항목 */
export const TREND_CATEGORIES: SignalCategory[] = [
  "meal",
  "sleep",
  "medication",
  "physical",
  "emotional",
  "social",
  "outing",
  "help_request",
];

export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  scheduled: "예정",
  in_progress: "통화 중",
  completed: "통화 완료",
  no_answer: "미응답",
  failed: "발신 실패",
};

export const CONSENT_LABEL: Record<ConsentStatus, string> = {
  pending: "동의 대기",
  granted: "동의 완료",
  withdrawn: "동의 철회",
};

export const INTERVENTION_LABEL: Record<InterventionAction, string> = {
  call_client: "대상자에게 전화 확인",
  call_guardian: "보호자에게 연락",
  home_visit: "가정방문 실시",
  medical_check: "의료기관 이용 확인",
  other: "기타",
};

export const AI_DISCLAIMER = "AI 분석 결과는 참고정보이며 최종 판단은 담당자가 확인합니다.";

export const URGENT_NOTICE = "긴급 확인이 필요한 신호가 감지되었습니다.";

export const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];
