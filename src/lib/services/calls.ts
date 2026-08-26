import { getLlmProvider } from "../ai";
import { CLOSING, GREETING } from "../ai/questions";
import { assertAccess } from "../auth";
import { URGENT_NOTICE } from "../labels";
import { analyzeTranscript } from "../risk/analyze";
import { getStore } from "../store";
import { getCallProvider } from "../telephony";
import type {
  Call,
  CategoryFinding,
  RiskLevel,
  SignalCategory,
  TranscriptTurn,
  User,
} from "../types";

export interface RunCallOptions {
  clientId: string;
  scenarioId: string;
  customReplies?: string[];
  actor: User;
}

export interface RunCallResult {
  call: Call;
  clientMaskedName: string;
  summary: string;
  riskLevel: RiskLevel;
  categories: CategoryFinding[];
  signalCount: number;
  notified: boolean;
  providerName: string;
  isRealCall: boolean;
}

const MAX_TURNS = 10;

/**
 * 가상 안부전화를 실행하고 분석 결과까지 저장한다.
 * 전화 제공자와 LLM 제공자를 인터페이스로만 사용하므로 실제 API로 교체해도 흐름은 동일하다.
 */
export async function runSimulatedCall(options: RunCallOptions): Promise<RunCallResult> {
  const store = getStore();
  const client = await store.getClient(options.clientId);
  if (!client) throw new Error("대상자를 찾을 수 없습니다.");
  assertAccess(options.actor, client);

  if (client.consent_status !== "granted") {
    throw new Error("개인정보 처리 동의가 확인되지 않아 안부전화를 진행할 수 없습니다.");
  }
  if (!client.recording_consent) {
    throw new Error("통화 내용 AI 처리에 대한 동의가 확인되지 않았습니다.");
  }

  const telephony = getCallProvider();
  const llm = getLlmProvider();

  const startedAt = new Date();
  const draft = await store.createCall({
    client_id: client.id,
    started_at: startedAt.toISOString(),
    ended_at: null,
    status: "in_progress",
    transcript: [],
    ai_summary: "",
    risk_level: "normal",
    category_findings: [],
    decided_by: "none",
    ai_provider: llm.name,
    acknowledged_by: null,
    acknowledged_at: null,
  });

  const session = await telephony.placeCall({
    callId: draft.id,
    clientName: client.name,
    phone: client.phone,
    scenarioId: options.scenarioId,
    customReplies: options.customReplies,
  });

  const previousCalls = await store.listCalls({ clientId: client.id, status: "completed" });
  const previousSummaries = previousCalls.slice(0, 3).map((c) => c.ai_summary);

  if (!session.answered) {
    await telephony.hangUp(session);
    const updated = await store.updateCall(draft.id, {
      status: "no_answer",
      ended_at: new Date().toISOString(),
      ai_summary: "전화 연결이 되지 않아 통화가 이루어지지 않았습니다.",
    });
    await store.createAuditLog({
      actor_id: options.actor.id,
      actor_name: options.actor.name,
      action: "call.no_answer",
      target: client.id,
      detail: `${client.masked_name} 대상자 안부전화 미응답`,
    });
    return {
      call: updated as Call,
      clientMaskedName: client.masked_name,
      summary: "전화 연결이 되지 않아 통화가 이루어지지 않았습니다.",
      riskLevel: "normal",
      categories: [],
      signalCount: 0,
      notified: false,
      providerName: llm.name,
      isRealCall: telephony.isReal,
    };
  }

  const transcript: TranscriptTurn[] = [];
  let clock = startedAt.getTime();
  const stamp = () => {
    clock += 12_000;
    return new Date(clock).toISOString();
  };

  transcript.push({ speaker: "ai", text: GREETING(client.name), at: stamp() });

  const asked: SignalCategory[] = [];
  const followedUp: SignalCategory[] = [];
  let lastReply: string | null = null;

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const question = await llm.nextQuestion({
      clientName: client.name,
      askedCategories: asked,
      followedUpCategories: followedUp,
      lastClientUtterance: lastReply,
      previousSummaries,
    });
    if (question.category) {
      if (question.isFollowUp) followedUp.push(question.category);
      else asked.push(question.category);
    }
    transcript.push({ speaker: "ai", text: question.text, at: stamp() });

    const heard = await telephony.speakAndListen(session, question.text);
    if (heard.text === null) break;
    transcript.push({ speaker: "client", text: heard.text, at: stamp() });
    lastReply = heard.text;
    if (heard.ended) break;
  }

  transcript.push({ speaker: "ai", text: CLOSING, at: stamp() });
  await telephony.hangUp(session);

  const analysis = await analyzeTranscript(transcript, previousSummaries);

  const call = (await store.updateCall(draft.id, {
    status: "completed",
    ended_at: new Date(clock).toISOString(),
    transcript,
    ai_summary: analysis.summary,
    risk_level: analysis.overall,
    category_findings: analysis.categories,
    decided_by: analysis.decided_by,
    ai_provider: analysis.provider,
  })) as Call;

  if (analysis.signals.length > 0) {
    await store.createRiskSignals(
      analysis.signals.map((signal) => ({
        call_id: call.id,
        client_id: client.id,
        category: signal.category,
        detected_text: signal.detected_text,
        risk_level: signal.risk_level,
        ai_reason: signal.ai_reason,
        source: signal.source,
      })),
    );
  }

  let notified = false;
  if (analysis.overall !== "normal") {
    await store.createNotification({
      client_id: client.id,
      call_id: call.id,
      worker_id: client.assigned_worker,
      risk_level: analysis.overall,
      title:
        analysis.overall === "urgent"
          ? `[AI 안심돌봄] ${client.masked_name} 대상자 긴급 확인 필요`
          : `[AI 안심돌봄] ${client.masked_name} 대상자 확인 필요`,
      body:
        analysis.overall === "urgent"
          ? `${client.masked_name} 대상자의 오늘 안부전화에서 '${URGENT_NOTICE}' AI 분석 결과만으로 긴급상황을 확정하지 말고 대상자 상태를 직접 확인해 주세요.`
          : `${client.masked_name} 대상자의 오늘 안부전화에서 확인이 필요한 신호가 감지되었습니다. 담당자 확인을 부탁드립니다.`,
    });
    notified = true;
  }

  await store.createAuditLog({
    actor_id: options.actor.id,
    actor_name: options.actor.name,
    action: "call.simulate",
    target: client.id,
    detail: `${client.masked_name} 대상자 안부전화 실행 (판정: ${analysis.overall})`,
  });

  return {
    call,
    clientMaskedName: client.masked_name,
    summary: analysis.summary,
    riskLevel: analysis.overall,
    categories: analysis.categories,
    signalCount: analysis.signals.length,
    notified,
    providerName: analysis.provider,
    isRealCall: telephony.isReal,
  };
}
