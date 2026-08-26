"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAccess, getCurrentUser, setCurrentUserCookie } from "@/lib/auth";
import { normalizePhone, retentionUntil } from "@/lib/privacy";
import { runSimulatedCall } from "@/lib/services/calls";
import { getStore } from "@/lib/store";
import type { CategoryFinding, ConsentStatus, InterventionAction, RiskLevel } from "@/lib/types";

function revalidateAll(clientId?: string) {
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath("/notifications");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export interface SimulationState {
  ok: boolean;
  message: string;
  result?: {
    callId: string;
    clientId: string;
    maskedName: string;
    status: string;
    riskLevel: RiskLevel;
    summary: string;
    categories: CategoryFinding[];
    transcript: { speaker: "ai" | "client"; text: string }[];
    notified: boolean;
    provider: string;
    simulated: boolean;
  };
}

export async function simulateCallAction(
  _prev: SimulationState,
  formData: FormData,
): Promise<SimulationState> {
  const clientId = String(formData.get("clientId") ?? "");
  const scenarioId = String(formData.get("scenarioId") ?? "normal");
  const customText = String(formData.get("customReplies") ?? "").trim();

  if (!clientId) return { ok: false, message: "대상자를 선택해 주세요." };

  const customReplies =
    scenarioId === "custom"
      ? customText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : undefined;

  if (scenarioId === "custom" && (!customReplies || customReplies.length === 0)) {
    return { ok: false, message: "직접 입력 시나리오는 대상자 발언을 한 줄에 하나씩 입력해 주세요." };
  }

  try {
    const user = await getCurrentUser();
    const result = await runSimulatedCall({ clientId, scenarioId, customReplies, actor: user });
    revalidateAll(clientId);
    return {
      ok: true,
      message: "안부전화 결과가 대시보드에 반영되었습니다.",
      result: {
        callId: result.call.id,
        clientId,
        maskedName: result.clientMaskedName,
        status: result.call.status,
        riskLevel: result.riskLevel,
        summary: result.summary,
        categories: result.categories,
        transcript: result.call.transcript.map((t) => ({ speaker: t.speaker, text: t.text })),
        notified: result.notified,
        provider: result.providerName,
        simulated: !result.isRealCall,
      },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "통화 실행에 실패했습니다." };
  }
}

export interface FormState {
  ok: boolean;
  message: string;
}

export async function createClientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const store = getStore();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name || !phone) return { ok: false, message: "이름과 연락처는 필수입니다." };

  const consent = String(formData.get("consent_status") ?? "pending") as ConsentStatus;
  const days = formData.getAll("schedule_days").map((d) => Number(d));

  const created = await store.createClient({
    organization_id: user.organization_id,
    name,
    birth_year: Number(formData.get("birth_year")) || null,
    phone: normalizePhone(phone),
    guardian_name: String(formData.get("guardian_name") ?? "").trim(),
    guardian_phone: normalizePhone(String(formData.get("guardian_phone") ?? "").trim()),
    assigned_worker: String(formData.get("assigned_worker") ?? user.id),
    call_schedule: {
      days: days.length > 0 ? days : [1, 3, 5],
      time: String(formData.get("schedule_time") ?? "09:00"),
    },
    consent_status: consent,
    recording_consent: formData.get("recording_consent") === "on",
    consent_updated_at: consent === "granted" ? new Date().toISOString() : null,
    note: String(formData.get("note") ?? "").trim(),
    retention_until: retentionUntil(),
  });

  await store.createAuditLog({
    actor_id: user.id,
    actor_name: user.name,
    action: "client.create",
    target: created.id,
    detail: `${created.masked_name} 대상자를 등록했습니다.`,
  });

  revalidateAll(created.id);
  return redirect(`/clients/${created.id}`);
}

export async function updateConsentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const store = getStore();
  const clientId = String(formData.get("clientId") ?? "");
  const client = await store.getClient(clientId);
  if (!client) return { ok: false, message: "대상자를 찾을 수 없습니다." };
  assertAccess(user, client);

  const consent = String(formData.get("consent_status") ?? "pending") as ConsentStatus;
  await store.updateClient(clientId, {
    consent_status: consent,
    recording_consent: formData.get("recording_consent") === "on",
    consent_updated_at: new Date().toISOString(),
  });

  await store.createAuditLog({
    actor_id: user.id,
    actor_name: user.name,
    action: "client.consent_update",
    target: clientId,
    detail: `${client.masked_name} 대상자 동의 상태를 '${consent}'로 변경했습니다.`,
  });

  revalidateAll(clientId);
  return { ok: true, message: "동의 상태를 저장했습니다." };
}

export async function recordInterventionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const store = getStore();

  const clientId = String(formData.get("clientId") ?? "");
  const client = await store.getClient(clientId);
  if (!client) return { ok: false, message: "대상자를 찾을 수 없습니다." };
  assertAccess(user, client);

  const action = String(formData.get("action") ?? "other") as InterventionAction;
  const note = String(formData.get("note") ?? "").trim();
  const callId = String(formData.get("callId") ?? "") || null;

  await store.createIntervention({
    client_id: clientId,
    call_id: callId,
    worker_id: user.id,
    action,
    note,
  });

  if (callId) {
    await store.updateCall(callId, {
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    });
  }

  for (const notification of await store.listNotifications({ unreadOnly: true })) {
    if (notification.client_id === clientId) await store.markNotificationRead(notification.id);
  }

  await store.createAuditLog({
    actor_id: user.id,
    actor_name: user.name,
    action: "intervention.create",
    target: clientId,
    detail: `${client.masked_name} 대상자 후속조치를 기록했습니다.`,
  });

  revalidateAll(clientId);
  return { ok: true, message: "후속조치를 기록했습니다." };
}

export async function acknowledgeCallAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const store = getStore();
  const callId = String(formData.get("callId") ?? "");
  const call = await store.getCall(callId);
  if (!call) return;
  const client = await store.getClient(call.client_id);
  if (!client) return;
  assertAccess(user, client);

  await store.updateCall(callId, {
    acknowledged_by: user.id,
    acknowledged_at: new Date().toISOString(),
  });
  await store.createAuditLog({
    actor_id: user.id,
    actor_name: user.name,
    action: "call.acknowledge",
    target: call.client_id,
    detail: `${client.masked_name} 대상자 통화 결과를 확인했습니다.`,
  });
  revalidateAll(call.client_id);
}

export async function switchUserAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  await setCurrentUserCookie(userId);
  revalidateAll();
  redirect("/");
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const store = getStore();
  const id = String(formData.get("notificationId") ?? "");
  if (!id) return;
  await store.markNotificationRead(id);
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function purgeExpiredAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user.role !== "admin") throw new Error("관리자만 실행할 수 있습니다.");
  const store = getStore();
  const result = await store.purgeExpired();
  await store.createAuditLog({
    actor_id: user.id,
    actor_name: user.name,
    action: "privacy.purge",
    target: "system",
    detail: `보유기간이 지난 대상자 ${result.clients}명, 통화기록 ${result.calls}건을 삭제했습니다.`,
  });
  revalidatePath("/privacy");
  revalidateAll();
}
