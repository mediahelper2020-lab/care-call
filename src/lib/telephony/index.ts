import { SimulationCallProvider } from "./simulation";
import type { CallProvider } from "./types";

let cached: CallProvider | null = null;

/**
 * 전화 제공자를 선택한다.
 * 2단계에서 실제 Voice API 제공자를 추가하면 CARE_CALL_PROVIDER로 교체한다.
 */
export function getCallProvider(): CallProvider {
  if (cached) return cached;
  const requested = (process.env.CARE_CALL_PROVIDER ?? "simulation").toLowerCase();
  if (requested !== "simulation") {
    console.warn(`[telephony] '${requested}' 제공자는 아직 구현되지 않아 시뮬레이션으로 동작합니다.`);
  }
  cached = new SimulationCallProvider();
  return cached;
}

export type { CallProvider, CallSession, ListenResult, PlaceCallRequest } from "./types";
