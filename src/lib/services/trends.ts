import { daysAgoKst } from "../datetime";
import { CATEGORY_LABEL, TREND_CATEGORIES } from "../labels";
import { getStore } from "../store";
import type { Call, RiskSignal, SignalCategory } from "../types";

export interface TrendItem {
  category: SignalCategory;
  label: string;
  last7: number;
  previous7: number;
  last30: number;
  direction: "up" | "down" | "flat";
}

export interface TrendSummary {
  items: TrendItem[];
  responseRate7: number;
  responseRate30: number;
  callCount7: number;
  callCount30: number;
  /** 사회복지사가 바로 읽을 수 있는 문장 */
  messages: string[];
}

/** 최근 7일·30일 데이터를 항목별로 비교한다. */
export async function getTrends(clientId: string, now: Date = new Date()): Promise<TrendSummary> {
  const store = getStore();
  const [calls, signals] = await Promise.all([
    store.listCalls({ clientId, since: daysAgoKst(30, now).toISOString() }),
    store.listRiskSignals({ clientId }),
  ]);

  const day7 = daysAgoKst(7, now).toISOString();
  const day14 = daysAgoKst(14, now).toISOString();
  const day30 = daysAgoKst(30, now).toISOString();

  const inRange = (signal: RiskSignal, from: string, to?: string) =>
    signal.created_at >= from && (!to || signal.created_at < to);

  const items: TrendItem[] = TREND_CATEGORIES.map((category) => {
    const scoped = signals.filter((s) => s.category === category);
    const last7 = scoped.filter((s) => inRange(s, day7)).length;
    const previous7 = scoped.filter((s) => inRange(s, day14, day7)).length;
    const last30 = scoped.filter((s) => inRange(s, day30)).length;
    return {
      category,
      label: CATEGORY_LABEL[category],
      last7,
      previous7,
      last30,
      direction: last7 > previous7 ? "up" : last7 < previous7 ? "down" : "flat",
    };
  });

  const calls7 = calls.filter((c) => c.started_at >= day7);
  const calls30 = calls.filter((c) => c.started_at >= day30);

  const summary: TrendSummary = {
    items,
    responseRate7: responseRate(calls7),
    responseRate30: responseRate(calls30),
    callCount7: calls7.length,
    callCount30: calls30.length,
    messages: [],
  };

  summary.messages = buildMessages(summary);
  return summary;
}

function responseRate(calls: Call[]): number {
  if (calls.length === 0) return 0;
  const answered = calls.filter((c) => c.status === "completed").length;
  return Math.round((answered / calls.length) * 100);
}

function buildMessages(summary: TrendSummary): string[] {
  const messages: string[] = [];

  const rising = summary.items
    .filter((item) => item.direction === "up" && item.last7 >= 2)
    .sort((a, b) => b.last7 - b.previous7 - (a.last7 - a.previous7));
  for (const item of rising.slice(0, 3)) {
    messages.push(`최근 7일간 ${item.label} 관련 어려움 언급 증가 (${item.previous7}회 → ${item.last7}회)`);
  }

  const easing = summary.items.filter((item) => item.direction === "down" && item.previous7 >= 2);
  for (const item of easing.slice(0, 2)) {
    messages.push(`최근 7일간 ${item.label} 관련 언급 감소 (${item.previous7}회 → ${item.last7}회)`);
  }

  if (summary.callCount7 > 0 && summary.responseRate7 < 70) {
    messages.push(`최근 7일 통화 응답률이 ${summary.responseRate7}%로 낮습니다. 연락 방법 점검이 필요합니다.`);
  } else if (summary.callCount30 > 0 && summary.responseRate7 < summary.responseRate30 - 15) {
    messages.push(
      `통화 응답률이 최근 7일 ${summary.responseRate7}%로, 30일 평균 ${summary.responseRate30}%보다 낮아졌습니다.`,
    );
  }

  if (messages.length === 0) {
    messages.push("최근 30일간 두드러진 변화는 확인되지 않았습니다.");
  }
  return messages;
}
