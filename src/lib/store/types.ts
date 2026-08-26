import type {
  AuditLog,
  Call,
  Client,
  Intervention,
  Notification,
  Organization,
  RiskSignal,
  User,
} from "../types";

export type NewClient = Omit<Client, "id" | "created_at" | "retention_until" | "masked_name"> &
  Partial<Pick<Client, "retention_until">>;
export type NewCall = Omit<Call, "id">;
export type NewRiskSignal = Omit<RiskSignal, "id" | "created_at">;
export type NewIntervention = Omit<Intervention, "id" | "created_at">;
export type NewNotification = Omit<Notification, "id" | "created_at" | "read_at">;
export type NewAuditLog = Omit<AuditLog, "id" | "created_at">;

export interface CallFilter {
  clientId?: string;
  since?: string;
  status?: Call["status"];
}

/**
 * 저장소 인터페이스. MVP는 메모리 구현을 사용하고,
 * Supabase 자격증명이 설정되면 동일 인터페이스의 Supabase 구현으로 교체된다.
 */
export interface DataStore {
  readonly name: string;

  listOrganizations(): Promise<Organization[]>;
  listUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | null>;

  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | null>;
  createClient(input: NewClient): Promise<Client>;
  updateClient(id: string, patch: Partial<Client>): Promise<Client | null>;
  deleteClient(id: string): Promise<boolean>;

  listCalls(filter?: CallFilter): Promise<Call[]>;
  getCall(id: string): Promise<Call | null>;
  createCall(input: NewCall): Promise<Call>;
  updateCall(id: string, patch: Partial<Call>): Promise<Call | null>;

  listRiskSignals(filter?: { callId?: string; clientId?: string }): Promise<RiskSignal[]>;
  createRiskSignals(signals: NewRiskSignal[]): Promise<RiskSignal[]>;

  listInterventions(filter?: { clientId?: string }): Promise<Intervention[]>;
  createIntervention(input: NewIntervention): Promise<Intervention>;

  listNotifications(filter?: { workerId?: string; unreadOnly?: boolean }): Promise<Notification[]>;
  createNotification(input: NewNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;

  listAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(input: NewAuditLog): Promise<AuditLog>;

  /** 보유기간이 지난 개인정보를 삭제한다. */
  purgeExpired(now?: Date): Promise<{ clients: number; calls: number }>;
}
