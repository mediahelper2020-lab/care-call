import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { decryptField, encryptField, maskName, retentionUntil } from "../privacy";
import type {
  AuditLog,
  Call,
  CallSchedule,
  CategoryFinding,
  Client,
  Intervention,
  Notification,
  Organization,
  RiskSignal,
  TranscriptTurn,
  User,
} from "../types";
import type {
  CallFilter,
  DataStore,
  NewAuditLog,
  NewCall,
  NewClient,
  NewIntervention,
  NewNotification,
  NewRiskSignal,
} from "./types";

/** PostgREST 기본 응답 상한을 넘지 않도록 조회에 상한을 둔다. */
const MAX_ROWS = 2000;

export function supabaseCredentials(): { url: string; serviceKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

export function createServiceClient(): SupabaseClient {
  const credentials = supabaseCredentials();
  if (!credentials) {
    throw new Error(
      "Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해 주세요.",
    );
  }
  return createClient(credentials.url, credentials.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Supabase 오류를 사람이 읽을 수 있는 메시지로 바꾼다. */
function fail(context: string, error: { message: string; hint?: string | null } | null): never {
  const hint = error?.hint ? ` (${error.hint})` : "";
  throw new Error(`${context} 실패: ${error?.message ?? "알 수 없는 오류"}${hint}`);
}

/* ── 행 ↔ 도메인 변환 ─────────────────────────────────────── */

interface ClientRow {
  id: string;
  organization_id: string;
  name: string;
  masked_name: string;
  birth_year: number | null;
  phone: string;
  guardian_name: string;
  guardian_phone: string;
  assigned_worker: string | null;
  call_schedule: CallSchedule;
  consent_status: string;
  recording_consent: boolean;
  consent_updated_at: string | null;
  note: string;
  created_at: string;
  retention_until: string;
}

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: decryptField(row.name),
    masked_name: row.masked_name,
    birth_year: row.birth_year,
    phone: decryptField(row.phone),
    guardian_name: decryptField(row.guardian_name),
    guardian_phone: decryptField(row.guardian_phone),
    assigned_worker: row.assigned_worker ?? "",
    call_schedule: row.call_schedule,
    consent_status: row.consent_status as Client["consent_status"],
    recording_consent: row.recording_consent,
    consent_updated_at: row.consent_updated_at,
    note: row.note,
    created_at: row.created_at,
    retention_until: row.retention_until,
  };
}

export function clientRow(client: Client): ClientRow {
  return {
    id: client.id,
    organization_id: client.organization_id,
    name: encryptField(client.name),
    masked_name: client.masked_name,
    birth_year: client.birth_year,
    phone: encryptField(client.phone),
    guardian_name: encryptField(client.guardian_name),
    guardian_phone: encryptField(client.guardian_phone),
    assigned_worker: client.assigned_worker || null,
    call_schedule: client.call_schedule,
    consent_status: client.consent_status,
    recording_consent: client.recording_consent,
    consent_updated_at: client.consent_updated_at,
    note: client.note,
    created_at: client.created_at,
    retention_until: client.retention_until,
  };
}

interface CallRow {
  id: string;
  client_id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  transcript: string;
  ai_summary: string;
  risk_level: string;
  category_findings: CategoryFinding[];
  decided_by: string;
  ai_provider: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

function toCall(row: CallRow): Call {
  const raw = decryptField(row.transcript);
  return {
    id: row.id,
    client_id: row.client_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    status: row.status as Call["status"],
    transcript: raw ? (JSON.parse(raw) as TranscriptTurn[]) : [],
    ai_summary: row.ai_summary,
    risk_level: row.risk_level as Call["risk_level"],
    category_findings: row.category_findings ?? [],
    decided_by: row.decided_by as Call["decided_by"],
    ai_provider: row.ai_provider,
    acknowledged_by: row.acknowledged_by,
    acknowledged_at: row.acknowledged_at,
  };
}

export function callRow(call: Call): CallRow {
  return {
    id: call.id,
    client_id: call.client_id,
    started_at: call.started_at,
    ended_at: call.ended_at,
    status: call.status,
    transcript: encryptField(JSON.stringify(call.transcript)),
    ai_summary: call.ai_summary,
    risk_level: call.risk_level,
    category_findings: call.category_findings,
    decided_by: call.decided_by,
    ai_provider: call.ai_provider,
    acknowledged_by: call.acknowledged_by,
    acknowledged_at: call.acknowledged_at,
  };
}

/* ── 저장소 ───────────────────────────────────────────────── */

/**
 * Supabase 저장소. 서버에서 service_role 키로만 접근한다.
 * 메모리 구현과 같은 DataStore 인터페이스를 구현하므로 서비스 코드는 동일하다.
 */
export class SupabaseStore implements DataStore {
  readonly name = "supabase";
  private db: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.db = client ?? createServiceClient();
  }

  async listOrganizations(): Promise<Organization[]> {
    const { data, error } = await this.db.from("organizations").select("id, name");
    if (error) fail("기관 목록 조회", error);
    return (data ?? []) as Organization[];
  }

  async listUsers(): Promise<User[]> {
    const { data, error } = await this.db
      .from("users")
      .select("id, name, role, organization_id")
      .order("id");
    if (error) fail("사용자 목록 조회", error);
    return (data ?? []) as User[];
  }

  async getUser(id: string): Promise<User | null> {
    const { data, error } = await this.db
      .from("users")
      .select("id, name, role, organization_id")
      .eq("id", id)
      .maybeSingle();
    if (error) fail("사용자 조회", error);
    return (data as User) ?? null;
  }

  async listClients(): Promise<Client[]> {
    const { data, error } = await this.db
      .from("clients")
      .select("*")
      .order("id")
      .limit(MAX_ROWS);
    if (error) fail("대상자 목록 조회", error);
    return ((data ?? []) as ClientRow[]).map(toClient);
  }

  async getClient(id: string): Promise<Client | null> {
    const { data, error } = await this.db.from("clients").select("*").eq("id", id).maybeSingle();
    if (error) fail("대상자 조회", error);
    return data ? toClient(data as ClientRow) : null;
  }

  async createClient(input: NewClient): Promise<Client> {
    const client: Client = {
      ...input,
      id: newId("client"),
      masked_name: maskName(input.name),
      created_at: new Date().toISOString(),
      retention_until: input.retention_until ?? retentionUntil(),
    };
    const { error } = await this.db.from("clients").insert(clientRow(client));
    if (error) fail("대상자 등록", error);
    return client;
  }

  async updateClient(id: string, patch: Partial<Client>): Promise<Client | null> {
    const current = await this.getClient(id);
    if (!current) return null;
    const updated: Client = { ...current, ...patch };
    if (patch.name) updated.masked_name = maskName(patch.name);
    const { error } = await this.db.from("clients").update(clientRow(updated)).eq("id", id);
    if (error) fail("대상자 수정", error);
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    const { error } = await this.db.from("clients").delete().eq("id", id);
    if (error) fail("대상자 삭제", error);
    return true;
  }

  async listCalls(filter: CallFilter = {}): Promise<Call[]> {
    let query = this.db.from("calls").select("*");
    if (filter.clientId) query = query.eq("client_id", filter.clientId);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.since) query = query.gte("started_at", filter.since);
    const { data, error } = await query.order("started_at", { ascending: false }).limit(MAX_ROWS);
    if (error) fail("통화 목록 조회", error);
    return ((data ?? []) as CallRow[]).map(toCall);
  }

  async getCall(id: string): Promise<Call | null> {
    const { data, error } = await this.db.from("calls").select("*").eq("id", id).maybeSingle();
    if (error) fail("통화 조회", error);
    return data ? toCall(data as CallRow) : null;
  }

  async createCall(input: NewCall): Promise<Call> {
    const call: Call = { ...input, id: newId("call") };
    const { error } = await this.db.from("calls").insert(callRow(call));
    if (error) fail("통화 기록 생성", error);
    return call;
  }

  async updateCall(id: string, patch: Partial<Call>): Promise<Call | null> {
    const current = await this.getCall(id);
    if (!current) return null;
    const updated: Call = { ...current, ...patch };
    const { error } = await this.db.from("calls").update(callRow(updated)).eq("id", id);
    if (error) fail("통화 기록 수정", error);
    return updated;
  }

  async listRiskSignals(filter: { callId?: string; clientId?: string } = {}): Promise<RiskSignal[]> {
    let query = this.db.from("risk_signals").select("*");
    if (filter.callId) query = query.eq("call_id", filter.callId);
    if (filter.clientId) query = query.eq("client_id", filter.clientId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(MAX_ROWS);
    if (error) fail("위험 신호 조회", error);
    return (data ?? []) as RiskSignal[];
  }

  async createRiskSignals(input: NewRiskSignal[]): Promise<RiskSignal[]> {
    if (input.length === 0) return [];
    const created: RiskSignal[] = input.map((signal) => ({
      ...signal,
      id: newId("signal"),
      created_at: new Date().toISOString(),
    }));
    const { error } = await this.db.from("risk_signals").insert(created);
    if (error) fail("위험 신호 저장", error);
    return created;
  }

  async listInterventions(filter: { clientId?: string } = {}): Promise<Intervention[]> {
    let query = this.db.from("interventions").select("*");
    if (filter.clientId) query = query.eq("client_id", filter.clientId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(MAX_ROWS);
    if (error) fail("후속조치 조회", error);
    return (data ?? []) as Intervention[];
  }

  async createIntervention(input: NewIntervention): Promise<Intervention> {
    const created: Intervention = {
      ...input,
      id: newId("intv"),
      created_at: new Date().toISOString(),
    };
    const { error } = await this.db.from("interventions").insert(created);
    if (error) fail("후속조치 기록", error);
    return created;
  }

  async listNotifications(
    filter: { workerId?: string; unreadOnly?: boolean } = {},
  ): Promise<Notification[]> {
    let query = this.db.from("notifications").select("*");
    if (filter.workerId) query = query.eq("worker_id", filter.workerId);
    if (filter.unreadOnly) query = query.is("read_at", null);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(MAX_ROWS);
    if (error) fail("알림 조회", error);
    return (data ?? []) as Notification[];
  }

  async createNotification(input: NewNotification): Promise<Notification> {
    const created: Notification = {
      ...input,
      id: newId("noti"),
      read_at: null,
      created_at: new Date().toISOString(),
    };
    const { error } = await this.db.from("notifications").insert(created);
    if (error) fail("알림 생성", error);
    return created;
  }

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await this.db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) fail("알림 읽음 처리", error);
  }

  async listAuditLogs(limit = 100): Promise<AuditLog[]> {
    const { data, error } = await this.db
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("활동 로그 조회", error);
    return (data ?? []) as AuditLog[];
  }

  async createAuditLog(input: NewAuditLog): Promise<AuditLog> {
    const created: AuditLog = {
      ...input,
      id: newId("audit"),
      created_at: new Date().toISOString(),
    };
    const { error } = await this.db.from("audit_logs").insert(created);
    if (error) fail("활동 로그 기록", error);
    return created;
  }

  async purgeExpired(now: Date = new Date()): Promise<{ clients: number; calls: number }> {
    const cutoff = now.toISOString();
    const { data: expired, error: selectError } = await this.db
      .from("clients")
      .select("id")
      .lte("retention_until", cutoff);
    if (selectError) fail("보유기간 만료 대상 조회", selectError);

    const ids = (expired ?? []).map((row) => (row as { id: string }).id);
    if (ids.length === 0) return { clients: 0, calls: 0 };

    const { count, error: countError } = await this.db
      .from("calls")
      .select("id", { count: "exact", head: true })
      .in("client_id", ids);
    if (countError) fail("만료 통화기록 확인", countError);

    // 통화·신호·조치·알림은 외래키 cascade로 함께 삭제된다.
    const { error: deleteError } = await this.db.from("clients").delete().in("id", ids);
    if (deleteError) fail("보유기간 만료 데이터 삭제", deleteError);

    return { clients: ids.length, calls: count ?? 0 };
  }
}
