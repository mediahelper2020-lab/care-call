export interface PlaceCallRequest {
  callId: string;
  clientName: string;
  phone: string;
  /** 시뮬레이션 제공자에서 사용하는 시나리오 식별자 */
  scenarioId?: string;
  /** 시나리오 대신 직접 입력한 대상자 발언 */
  customReplies?: string[];
}

export interface CallSession {
  callId: string;
  /** 상대가 전화를 받았는지 */
  answered: boolean;
  providerRef: string;
}

export interface ListenResult {
  /** 대상자 발화. null이면 응답 없음. */
  text: string | null;
  /** 더 이상 이어갈 응답이 없으면 true */
  ended: boolean;
}

/**
 * 전화 모듈. 실제 Voice API를 붙일 때 이 인터페이스만 구현하면 된다.
 * 발신 → 발화 → 청취 → 종료의 4단계로만 서비스와 맞닿는다.
 */
export interface CallProvider {
  readonly name: string;
  /** 실제 통화 발신 여부. false면 화면에 시뮬레이션임을 표시한다. */
  readonly isReal: boolean;
  placeCall(request: PlaceCallRequest): Promise<CallSession>;
  /** AI가 한 문장 말한 뒤 대상자 응답을 듣는다. */
  speakAndListen(session: CallSession, aiUtterance: string): Promise<ListenResult>;
  hangUp(session: CallSession): Promise<void>;
}
