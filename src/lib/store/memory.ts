import { decryptField, encryptField, maskName, retentionUntil } from "../privacy";
import type {
  AuditLog,
  Call,
  Client,
  Intervention,
  Notification,
  Organization,
  RiskSignal,
  TranscriptTurn,
  User,
} from "../types";
import { buildSeed } from "./seed";
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

/** 저장 시에는 개인정보 필드를 암호화해 둔다. */
interface StoredClient extends Omit<Client, "name" | "phone" | "guardian_name" | "guardian_phone"> {
  name_enc: string;
  phone_enc: string;
  guardian_name_enc: string;
  guardian_phone_enc: string;
}

interface StoredCall extends Omit<Call, "transcript"> {
  transcript_enc: string;
}

interface Db {
  organizations: Organization[];
  users: User[];
  clients: StoredClient[];
  calls: StoredCall[];
  signals: RiskSignal[];
  interventions: Intervention[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  sequences: Record<string, number>;
}

function toStoredClient(client: Client): StoredClient {
  const { name, phone, guardian_name, guardian_phone, ...rest } = client;
  return {
    ...rest,
    name_enc: encryptField(name),
    phone_enc: encryptField(phone),
    guardian_name_enc: encryptField(guardian_name),
    guardian_phone_enc: encryptField(guardian_phone),
  };
}

function fromStoredClient(stored: StoredClient): Client {
  const { name_enc, phone_enc, guardian_name_enc, guardian_phone_enc, ...rest } = stored;
  return {
    ...rest,
    name: decryptField(name_enc),
    phone: decryptField(phone_enc),
    guardian_name: decryptField(guardian_name_enc),
    guardian_phone: decryptField(guardian_phone_enc),
  };
}

function toStoredCall(call: Call): StoredCall {
  const { transcript, ...rest } = call;
  return { ...rest, transcript_enc: encryptField(JSON.stringify(transcript)) };
}

function fromStoredCall(stored: StoredCall): Call {
  const { transcript_enc, ...rest } = stored;
  const raw = decryptField(transcript_enc);
  const transcript = raw ? (JSON.parse(raw) as TranscriptTurn[]) : [];
  return { ...rest, transcript };
}

function createDb(): Db {
  const seed = buildSeed();
  return {
    organizations: seed.organizations,
    users: seed.users,
    clients: seed.clients.map(toStoredClient),
    calls: seed.calls.map(toStoredCall),
    signals: seed.signals,
    interventions: seed.interventions,
    notifications: seed.notifications,
    auditLogs: seed.auditLogs,
    sequences: {
      client: seed.clients.length,
      call: seed.calls.length,
      signal: seed.signals.length,
      intervention: seed.interventions.length,
      notification: seed.notifications.length,
      audit: seed.auditLogs.length,
    },
  };
}

/** 개발 중 모듈이 다시 로드돼도 데이터가 초기화되지 않도록 전역에 보관한다. */
const globalRef = globalThis as unknown as { __careCallDb?: Db };

function db(): Db {
  if (!globalRef.__careCallDb) globalRef.__careCallDb = createDb();
  return globalRef.__careCallDb;
}

function nextId(kind: string, prefix: string, width: number): string {
  const store = db();
  store.sequences[kind] = (store.sequences[kind] ?? 0) + 1;
  return `${prefix}-${String(store.sequences[kind]).padStart(width, "0")}`;
}

/**
 * MVP용 메모리 저장소. DataStore 인터페이스를 그대로 구현하므로
 * Supabase 구현으로 교체해도 서비스 코드는 바뀌지 않는다.
 */
export class MemoryStore implements DataStore {
  readonly name = "memory";

  async listOrganizations(): Promise<Organization[]> {
    return [...db().organizations];
  }

  async listUsers(): Promise<User[]> {
    return [...db().users];
  }

  async getUser(id: string): Promise<User | null> {
    return db().users.find((u) => u.id === id) ?? null;
  }

  async listClients(): Promise<Client[]> {
    return db().clients.map(fromStoredClient);
  }

  async getClient(id: string): Promise<Client | null> {
    const found = db().clients.find((c) => c.id === id);
    return found ? fromStoredClient(found) : null;
  }

  async createClient(input: NewClient): Promise<Client> {
    const client: Client = {
      ...input,
      id: nextId("client", "client", 3),
      masked_name: maskName(input.name),
      created_at: new Date().toISOString(),
      retention_until: input.retention_until ?? retentionUntil(),
    };
    db().clients.push(toStoredClient(client));
    return client;
  }

  async updateClient(id: string, patch: Partial<Client>): Promise<Client | null> {
    const store = db();
    const index = store.clients.findIndex((c) => c.id === id);
    if (index < 0) return null;
    const current = fromStoredClient(store.clients[index]);
    const updated: Client = { ...current, ...patch };
    if (patch.name) updated.masked_name = maskName(patch.name);
    store.clients[index] = toStoredClient(updated);
    return updated;
  }

  async deleteClient(id: string): Promise<boolean> {
    const store = db();
    const index = store.clients.findIndex((c) => c.id === id);
    if (index < 0) return false;
    store.clients.splice(index, 1);
    store.calls = store.calls.filter((c) => c.client_id !== id);
    store.signals = store.signals.filter((s) => s.client_id !== id);
    store.interventions = store.interventions.filter((i) => i.client_id !== id);
    store.notifications = store.notifications.filter((n) => n.client_id !== id);
    return true;
  }

  async listCalls(filter: CallFilter = {}): Promise<Call[]> {
    let rows = db().calls;
    if (filter.clientId) rows = rows.filter((c) => c.client_id === filter.clientId);
    if (filter.status) rows = rows.filter((c) => c.status === filter.status);
    if (filter.since) {
      const since = filter.since;
      rows = rows.filter((c) => c.started_at >= since);
    }
    return rows
      .map(fromStoredCall)
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
  }

  async getCall(id: string): Promise<Call | null> {
    const found = db().calls.find((c) => c.id === id);
    return found ? fromStoredCall(found) : null;
  }

  async createCall(input: NewCall): Promise<Call> {
    const call: Call = { ...input, id: nextId("call", "call", 5) };
    db().calls.push(toStoredCall(call));
    return call;
  }

  async updateCall(id: string, patch: Partial<Call>): Promise<Call | null> {
    const store = db();
    const index = store.calls.findIndex((c) => c.id === id);
    if (index < 0) return null;
    const updated: Call = { ...fromStoredCall(store.calls[index]), ...patch };
    store.calls[index] = toStoredCall(updated);
    return updated;
  }

  async listRiskSignals(filter: { callId?: string; clientId?: string } = {}): Promise<RiskSignal[]> {
    let rows = [...db().signals];
    if (filter.callId) rows = rows.filter((s) => s.call_id === filter.callId);
    if (filter.clientId) rows = rows.filter((s) => s.client_id === filter.clientId);
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async createRiskSignals(input: NewRiskSignal[]): Promise<RiskSignal[]> {
    const created = input.map((signal) => ({
      ...signal,
      id: nextId("signal", "signal", 5),
      created_at: new Date().toISOString(),
    }));
    db().signals.push(...created);
    return created;
  }

  async listInterventions(filter: { clientId?: string } = {}): Promise<Intervention[]> {
    let rows = [...db().interventions];
    if (filter.clientId) rows = rows.filter((i) => i.client_id === filter.clientId);
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async createIntervention(input: NewIntervention): Promise<Intervention> {
    const created: Intervention = {
      ...input,
      id: nextId("intervention", "intv", 4),
      created_at: new Date().toISOString(),
    };
    db().interventions.push(created);
    return created;
  }

  async listNotifications(
    filter: { workerId?: string; unreadOnly?: boolean } = {},
  ): Promise<Notification[]> {
    let rows = [...db().notifications];
    if (filter.workerId) rows = rows.filter((n) => n.worker_id === filter.workerId);
    if (filter.unreadOnly) rows = rows.filter((n) => n.read_at === null);
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async createNotification(input: NewNotification): Promise<Notification> {
    const created: Notification = {
      ...input,
      id: nextId("notification", "noti", 4),
      read_at: null,
      created_at: new Date().toISOString(),
    };
    db().notifications.push(created);
    return created;
  }

  async markNotificationRead(id: string): Promise<void> {
    const found = db().notifications.find((n) => n.id === id);
    if (found) found.read_at = new Date().toISOString();
  }

  async listAuditLogs(limit = 100): Promise<AuditLog[]> {
    return [...db().auditLogs]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit);
  }

  async createAuditLog(input: NewAuditLog): Promise<AuditLog> {
    const created: AuditLog = {
      ...input,
      id: nextId("audit", "audit", 4),
      created_at: new Date().toISOString(),
    };
    db().auditLogs.push(created);
    return created;
  }

  async purgeExpired(now: Date = new Date()): Promise<{ clients: number; calls: number }> {
    const store = db();
    const cutoff = now.toISOString();
    const expired = store.clients.filter((c) => c.retention_until <= cutoff);
    const expiredIds = new Set(expired.map((c) => c.id));

    const removedCalls = store.calls.filter((c) => expiredIds.has(c.client_id)).length;
    store.clients = store.clients.filter((c) => !expiredIds.has(c.id));
    store.calls = store.calls.filter((c) => !expiredIds.has(c.client_id));
    store.signals = store.signals.filter((s) => !expiredIds.has(s.client_id));
    store.interventions = store.interventions.filter((i) => !expiredIds.has(i.client_id));
    store.notifications = store.notifications.filter((n) => !expiredIds.has(n.client_id));

    return { clients: expired.length, calls: removedCalls };
  }
}
