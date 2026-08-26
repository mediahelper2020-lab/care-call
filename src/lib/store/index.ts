import { MemoryStore } from "./memory";
import type { DataStore } from "./types";

let cached: DataStore | null = null;

/**
 * 저장소를 선택한다.
 * Supabase 환경변수가 채워지면 동일 인터페이스의 Supabase 구현으로 교체한다.
 */
export function getStore(): DataStore {
  if (cached) return cached;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[store] Supabase 구현은 2단계 과제입니다. 우선 메모리 저장소로 동작합니다.");
  }
  cached = new MemoryStore();
  return cached;
}

export function storeIsPersistent(): boolean {
  return getStore().name !== "memory";
}

export type { DataStore } from "./types";
