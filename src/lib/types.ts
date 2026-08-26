export type Role = "admin" | "worker";

/** 위험도 3단계. 화면 표기는 labels.ts 참고. */
export type RiskLevel = "normal" | "attention" | "urgent";

/** AI 분석 카테고리. 추이 분석 항목과 동일한 키를 사용한다. */
export type SignalCategory =
  | "meal"
  | "sleep"
  | "medication"
  | "physical"
  | "emotional"
  | "social"
  | "outing"
  | "help_request";

export type CallStatus = "scheduled" | "in_progress" | "completed" | "no_answer" | "failed";

export type ConsentStatus = "pending" | "granted" | "withdrawn";

export interface Organization {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  organization_id: string;
}

export interface Client {
  id: string;
  organization_id: string;
  /** 암호화되어 보관된다. 읽을 때는 store가 복호화한다. */
  name: string;
  masked_name: string;
  birth_year: number | null;
  phone: string;
  guardian_name: string;
  guardian_phone: string;
  assigned_worker: string;
  /** 요일(0=일)과 시각. 예: { days: [1,3,5], time: "09:00" } */
  call_schedule: CallSchedule;
  consent_status: ConsentStatus;
  /** 통화 녹음·AI 처리에 대한 별도 고지·동의 */
  recording_consent: boolean;
  consent_updated_at: string | null;
  note: string;
  created_at: string;
  /** 개인정보 보유기간 만료일. 지나면 정리 대상. */
  retention_until: string;
}

export interface CallSchedule {
  days: number[];
  time: string;
}

export interface TranscriptTurn {
  speaker: "ai" | "client";
  text: string;
  at: string;
}

export interface Call {
  id: string;
  client_id: string;
  started_at: string;
  ended_at: string | null;
  status: CallStatus;
  /** 암호화되어 보관된다. 열람은 권한 확인 후에만 허용한다. */
  transcript: TranscriptTurn[];
  ai_summary: string;
  risk_level: RiskLevel;
  /** 카테고리별 판정. 상세 화면의 'AI 분석' 표. */
  category_findings: CategoryFinding[];
  /** 규칙 기반 탐지와 AI 문맥 분석 중 무엇이 최종 판정을 이끌었는지 */
  decided_by: "rule" | "ai" | "both" | "none";
  ai_provider: string;
  /** 담당자가 결과를 확인했는지 */
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

export interface CategoryFinding {
  category: SignalCategory;
  level: RiskLevel;
  note: string;
}

export interface RiskSignal {
  id: string;
  call_id: string;
  client_id: string;
  category: SignalCategory;
  detected_text: string;
  risk_level: RiskLevel;
  ai_reason: string;
  source: "rule" | "ai";
  created_at: string;
}

export type InterventionAction =
  | "call_client"
  | "call_guardian"
  | "home_visit"
  | "medical_check"
  | "other";

export interface Intervention {
  id: string;
  client_id: string;
  call_id: string | null;
  worker_id: string;
  action: InterventionAction;
  note: string;
  created_at: string;
}

export interface Notification {
  id: string;
  client_id: string;
  call_id: string;
  worker_id: string;
  risk_level: RiskLevel;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target: string;
  detail: string;
  created_at: string;
}
