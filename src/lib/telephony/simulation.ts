import { getScenario } from "./scenarios";
import type { CallProvider, CallSession, ListenResult, PlaceCallRequest } from "./types";

interface SessionState {
  replies: string[];
  cursor: number;
}

const sessions = new Map<string, SessionState>();

/**
 * 가상 통화 시뮬레이션 제공자.
 * 실제 전화 API가 연결되지 않은 상태에서도 서비스 전체 흐름을 시연할 수 있게 한다.
 */
export class SimulationCallProvider implements CallProvider {
  readonly name = "simulation";
  readonly isReal = false;

  async placeCall(request: PlaceCallRequest): Promise<CallSession> {
    const replies =
      request.customReplies && request.customReplies.length > 0
        ? request.customReplies
        : (getScenario(request.scenarioId ?? "normal")?.replies ?? []);

    sessions.set(request.callId, { replies, cursor: 0 });
    return {
      callId: request.callId,
      answered: replies.length > 0,
      providerRef: `sim-${request.callId}`,
    };
  }

  async speakAndListen(session: CallSession): Promise<ListenResult> {
    const state = sessions.get(session.callId);
    if (!state) return { text: null, ended: true };
    if (state.cursor >= state.replies.length) return { text: null, ended: true };
    const text = state.replies[state.cursor];
    state.cursor += 1;
    return { text, ended: state.cursor >= state.replies.length };
  }

  async hangUp(session: CallSession): Promise<void> {
    sessions.delete(session.callId);
  }
}
