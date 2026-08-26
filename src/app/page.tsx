import Link from "next/link";
import { KpiCard } from "@/components/KpiCard";
import { RiskBadge } from "@/components/RiskBadge";
import { SimulationPanel } from "@/components/SimulationPanel";
import { getCurrentUser, visibleClients } from "@/lib/auth";
import { kstDateTimeLabel } from "@/lib/datetime";
import { AI_DISCLAIMER, RISK_LABEL } from "@/lib/labels";
import { getDashboard } from "@/lib/services/dashboard";
import { getStore } from "@/lib/store";
import { SCENARIOS } from "@/lib/telephony/scenarios";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const store = getStore();
  const now = new Date();

  const [dashboard, allClients, users] = await Promise.all([
    getDashboard(user, now),
    store.listClients(),
    store.listUsers(),
  ]);

  const workerNames = new Map(users.map((u) => [u.id, u.name]));
  const clients = visibleClients(user, allClients);
  const options = clients.slice(0, 60).map((client) => ({
    id: client.id,
    maskedName: client.masked_name,
    workerName: workerNames.get(client.assigned_worker) ?? "미지정",
  }));

  const scenarios = SCENARIOS.map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    headline: scenario.headline,
    expectedLabel: scenario.expected === "no_answer" ? "미응답" : RISK_LABEL[scenario.expected],
  }));

  const priorityRows = dashboard.rows.filter(
    (row) => row.status === "urgent" || row.status === "attention",
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            오늘의 돌봄 현황
          </h1>
          <p className="mt-1 text-base text-ink-500">{kstDateTimeLabel(now)} 기준</p>
        </div>
        <Link href="/clients/new" className="btn-secondary">
          대상자 등록
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="전체 대상자" value={dashboard.kpi.total} unit="명" tone="brand" />
        <KpiCard label="통화 완료" value={dashboard.kpi.completed} unit="명" tone="safe" />
        <KpiCard label="미응답" value={dashboard.kpi.noAnswer} unit="명" tone="neutral" />
        <KpiCard label="확인 필요" value={dashboard.kpi.attention} unit="명" tone="watch" />
        <KpiCard label="긴급 확인" value={dashboard.kpi.urgent} unit="명" tone="alert" />
      </section>

      {priorityRows.length > 0 ? (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 bg-alert-50/40 px-5 py-3">
            <h2 className="text-lg font-extrabold text-ink-900">먼저 확인이 필요한 대상자</h2>
            <span className="text-sm font-semibold text-ink-600">{priorityRows.length}명</span>
          </div>
          <ul className="divide-y divide-ink-100">
            {priorityRows.slice(0, 6).map((row) => (
              <li key={row.clientId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <RiskBadge status={row.status} size="sm" />
                <Link
                  href={`/clients/${row.clientId}`}
                  className="text-base font-bold text-brand-700 underline-offset-2 hover:underline"
                >
                  {row.maskedName}
                </Link>
                <span className="text-base text-ink-600">{row.mainSignal}</span>
                <span className="ml-auto text-sm text-ink-500">
                  {row.lastCallTime ?? "-"} · 담당 {row.workerName}
                  {row.acknowledged ? " · 확인 완료" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SimulationPanel clients={options} scenarios={scenarios} />

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-5 py-3">
          <h2 className="text-lg font-extrabold text-ink-900">대상자 목록</h2>
          <p className="text-sm text-ink-500">개인정보 보호를 위해 이름을 마스킹해 표시합니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-ink-50 text-sm font-bold text-ink-600">
                <th className="px-5 py-3">대상자</th>
                <th className="px-5 py-3">최근 통화</th>
                <th className="px-5 py-3">상태</th>
                <th className="px-5 py-3">주요 신호</th>
                <th className="px-5 py-3">담당자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {dashboard.rows.slice(0, 40).map((row) => (
                <tr key={row.clientId} className="hover:bg-brand-50/40">
                  <td className="px-5 py-3">
                    <Link
                      href={`/clients/${row.clientId}`}
                      className="text-base font-bold text-brand-700 underline-offset-2 hover:underline"
                    >
                      {row.maskedName}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-base text-ink-600">{row.lastCallTime ?? "-"}</td>
                  <td className="px-5 py-3">
                    <RiskBadge status={row.status} size="sm" />
                  </td>
                  <td className="px-5 py-3 text-base text-ink-600">{row.mainSignal}</td>
                  <td className="px-5 py-3 text-base text-ink-600">{row.workerName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-ink-200 px-5 py-3">
          <Link href="/clients" className="text-base font-bold text-brand-700 hover:underline">
            전체 대상자 보기 →
          </Link>
        </div>
      </section>

      <p className="rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm font-semibold text-ink-600">
        {AI_DISCLAIMER}
      </p>
    </div>
  );
}
