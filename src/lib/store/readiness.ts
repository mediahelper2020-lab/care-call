import { getSetupStatus, type SetupStatus } from "./supabase-setup";
import { supabaseCredentials } from "./supabase";

let confirmedReady = false;

/**
 * 서비스가 데이터를 읽을 준비가 되었는지 확인한다.
 * 준비되지 않았으면 화면에 설정 안내를 띄우기 위한 상태를 돌려준다.
 *
 * - 메모리 저장소로 동작할 때는 항상 준비된 상태로 본다.
 * - Supabase를 쓰는 경우 스키마 적용과 초기 데이터 여부를 한 번만 확인한다.
 */
export async function pendingSetup(): Promise<SetupStatus | null> {
  if (!supabaseCredentials()) return null;
  if (confirmedReady) return null;

  const status = await getSetupStatus();
  if (status.tablesReady && status.counts.users > 0) {
    confirmedReady = true;
    return null;
  }
  return status;
}

/** 초기 데이터를 새로 넣은 직후처럼 상태를 다시 확인해야 할 때 쓴다. */
export function invalidateReadiness(): void {
  confirmedReady = false;
}
