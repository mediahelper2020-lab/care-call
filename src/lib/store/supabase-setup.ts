import type { SupabaseClient } from "@supabase/supabase-js";
import { isProductionKeyConfigured } from "../privacy";
import { buildSeed } from "./seed";
import { callRow, clientRow, createServiceClient, supabaseCredentials } from "./supabase";

export interface SetupStatus {
  /** 환경변수가 채워져 있는지 */
  configured: boolean;
  /** 스키마가 적용되어 테이블에 접근할 수 있는지 */
  tablesReady: boolean;
  /** 운영용 암호화 키가 설정되어 있는지 */
  encryptionKeyReady: boolean;
  counts: { users: number; clients: number; calls: number };
  error: string | null;
}

const TABLES = [
  "audit_logs",
  "notifications",
  "interventions",
  "risk_signals",
  "calls",
  "clients",
  "users",
  "organizations",
] as const;

export async function getSetupStatus(): Promise<SetupStatus> {
  const base: SetupStatus = {
    configured: Boolean(supabaseCredentials()),
    tablesReady: false,
    encryptionKeyReady: isProductionKeyConfigured(),
    counts: { users: 0, clients: 0, calls: 0 },
    error: null,
  };
  if (!base.configured) return base;

  try {
    const db = createServiceClient();
    const [users, clients, calls] = await Promise.all([
      countRows(db, "users"),
      countRows(db, "clients"),
      countRows(db, "calls"),
    ]);
    return { ...base, tablesReady: true, counts: { users, clients, calls } };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) };
  }
}

async function countRows(db: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await db.from(table).select("id", { count: "exact", head: true });
  if (error) {
    throw new Error(
      `'${table}' 테이블에 접근할 수 없습니다. Supabase SQL Editor에서 supabase/schema.sql을 실행했는지 확인해 주세요. (${error.message})`,
    );
  }
  return count ?? 0;
}

async function insertBatched<T extends object>(
  db: SupabaseClient,
  table: string,
  rows: T[],
  // 통화 기록은 암호화된 전문을 담고 있어 한 번에 많이 보내면 요청이 커진다.
  size = 200,
): Promise<void> {
  for (let index = 0; index < rows.length; index += size) {
    // supabase-js의 insert 타입은 생성된 스키마 타입을 전제로 한다.
    // 이 프로젝트는 스키마 타입을 생성하지 않으므로 행 배열을 그대로 넘긴다.
    const batch = rows.slice(index, index + size) as never;
    const { error } = await db.from(table).insert(batch);
    if (error) {
      throw new Error(`'${table}' 저장 실패: ${error.message}`);
    }
  }
}

export interface SeedResult {
  clients: number;
  calls: number;
  signals: number;
  notifications: number;
}

/**
 * 시연용 초기 데이터를 Supabase에 넣는다.
 * 이미 대상자가 있으면 덮어쓰지 않고 중단한다.
 */
export async function seedSupabase(): Promise<SeedResult> {
  const db = createServiceClient();
  const existing = await countRows(db, "clients");
  if (existing > 0) {
    throw new Error(
      `이미 대상자 ${existing}명이 저장되어 있어 초기 데이터를 넣지 않았습니다. 처음부터 다시 넣으려면 Supabase에서 supabase/schema.sql을 다시 실행한 뒤 시도해 주세요.`,
    );
  }

  const seed = buildSeed();

  await insertBatched(db, "organizations", seed.organizations);
  await insertBatched(db, "users", seed.users);
  await insertBatched(db, "clients", seed.clients.map(clientRow));
  await insertBatched(db, "calls", seed.calls.map(callRow));
  await insertBatched(db, "risk_signals", seed.signals);
  await insertBatched(db, "interventions", seed.interventions);
  await insertBatched(db, "notifications", seed.notifications);
  await insertBatched(db, "audit_logs", seed.auditLogs);

  return {
    clients: seed.clients.length,
    calls: seed.calls.length,
    signals: seed.signals.length,
    notifications: seed.notifications.length,
  };
}

/** 모든 데이터를 지운다. 시연 데이터를 다시 넣기 전에 쓴다. */
export async function resetSupabase(): Promise<void> {
  const db = createServiceClient();
  for (const table of TABLES) {
    const { error } = await db.from(table).delete().neq("id", "");
    if (error) {
      throw new Error(`'${table}' 비우기 실패: ${error.message}`);
    }
  }
}
