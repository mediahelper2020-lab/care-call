import { visibleClients } from "../auth";
import { isSameKstDay, kstTimeLabel, startOfKstToday } from "../datetime";
import { RISK_ORDER } from "../labels";
import { getStore } from "../store";
import type { Call, Client, RiskLevel, User } from "../types";

export type RowStatus = RiskLevel | "no_answer" | "pending";

export interface DashboardRow {
  clientId: string;
  maskedName: string;
  lastCallTime: string | null;
  status: RowStatus;
  mainSignal: string;
  workerName: string;
  acknowledged: boolean;
  callId: string | null;
}

export interface DashboardKpi {
  total: number;
  completed: number;
  noAnswer: number;
  attention: number;
  urgent: number;
}

export interface DashboardData {
  kpi: DashboardKpi;
  rows: DashboardRow[];
}

const STATUS_ORDER: Record<RowStatus, number> = {
  urgent: 0,
  attention: 1,
  no_answer: 2,
  pending: 3,
  normal: 4,
};

/** 오늘의 통화 중 대상자별 가장 최근 건을 고른다. */
export function latestCallToday(calls: Call[], now: Date = new Date()): Map<string, Call> {
  const map = new Map<string, Call>();
  for (const call of calls) {
    if (!isSameKstDay(call.started_at, now)) continue;
    const current = map.get(call.client_id);
    if (!current || call.started_at > current.started_at) map.set(call.client_id, call);
  }
  return map;
}

export function mainSignalText(call: Call | undefined): string {
  if (!call) return "오늘 통화 예정";
  if (call.status === "no_answer") return "전화 미응답";
  const flagged = call.category_findings
    .filter((f) => f.level !== "normal")
    .sort((a, b) => RISK_ORDER[a.level] - RISK_ORDER[b.level]);
  if (flagged.length === 0) return "특이사항 없음";
  return flagged[0].note;
}

export async function getDashboard(user: User, now: Date = new Date()): Promise<DashboardData> {
  const store = getStore();
  const [allClients, users, calls] = await Promise.all([
    store.listClients(),
    store.listUsers(),
    store.listCalls({ since: startOfKstToday(now).toISOString() }),
  ]);

  const clients = visibleClients(user, allClients);
  const workerNames = new Map(users.map((u) => [u.id, u.name]));
  const todayCalls = latestCallToday(calls, now);

  const rows: DashboardRow[] = clients.map((client) => {
    const call = todayCalls.get(client.id);
    return {
      clientId: client.id,
      maskedName: client.masked_name,
      lastCallTime: call ? kstTimeLabel(call.started_at) : null,
      status: rowStatus(call),
      mainSignal: mainSignalText(call),
      workerName: workerNames.get(client.assigned_worker) ?? "미지정",
      acknowledged: Boolean(call?.acknowledged_by),
      callId: call?.id ?? null,
    };
  });

  rows.sort((a, b) => {
    const order = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (order !== 0) return order;
    return (b.lastCallTime ?? "").localeCompare(a.lastCallTime ?? "");
  });

  const kpi: DashboardKpi = {
    total: clients.length,
    completed: rows.filter((r) => r.status !== "no_answer" && r.status !== "pending").length,
    noAnswer: rows.filter((r) => r.status === "no_answer").length,
    attention: rows.filter((r) => r.status === "attention").length,
    urgent: rows.filter((r) => r.status === "urgent").length,
  };

  return { kpi, rows };
}

function rowStatus(call: Call | undefined): RowStatus {
  if (!call) return "pending";
  if (call.status === "no_answer" || call.status === "failed") return "no_answer";
  if (call.status === "scheduled" || call.status === "in_progress") return "pending";
  return call.risk_level;
}

export function clientDisplayName(client: Client, user: User): string {
  return user.role === "admin" || client.assigned_worker === user.id
    ? client.name
    : client.masked_name;
}
