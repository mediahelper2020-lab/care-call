import { MemoryStore } from "./memory";
import { SupabaseStore, supabaseCredentials } from "./supabase";
import type { DataStore } from "./types";

let cached: DataStore | null = null;

/**
 * 저장소를 선택한다.
 * Supabase 환경변수가 채워져 있으면 Supabase를, 없으면 메모리 저장소를 쓴다.
 * 두 구현 모두 같은 DataStore 인터페이스를 따르므로 서비스 코드는 바뀌지 않는다.
 */
export function getStore(): DataStore {
  if (cached) return cached;
  cached = supabaseCredentials() ? new SupabaseStore() : new MemoryStore();
  return cached;
}

/** 메모리 저장소는 서버가 다시 뜨면 초기화된다. 화면에서 이를 안내할 때 쓴다. */
export function storeIsPersistent(): boolean {
  return getStore().name !== "memory";
}

export type { DataStore } from "./types";
