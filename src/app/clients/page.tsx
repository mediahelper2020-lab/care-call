import Link from "next/link";
import { RiskBadge } from "@/components/RiskBadge";
import { getCurrentUser } from "@/lib/auth";
import { CONSENT_LABEL, DAY_LABEL } from "@/lib/labels";
import { getDashboard } from "@/lib/services/dashboard";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "urgent", label: "긴급 확인" },
  { key: "attention", label: "확인 필요" },
  { key: "no_answer", label: "미응답" },
  { key: "normal", label: "정상" },
] as const;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const active = params.status ?? "all";

  const user = await getCurrentUser();
  const store = getStore();
  const [dashboard, clients] = await Promise.all([getDashboard(user), store.listClients()]);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const rows = dashboard.rows.filter((row) => active === "all" || row.status === active);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            대상자 관리
          </h1>
          <p className="mt-1 text-base text-ink-500">
            전체 {dashboard.kpi.total}명 · 목록에서는 이름을 마스킹해 표시합니다.
          </p>
        </div>
        <Link href="/clients/new" className="btn-primary">
          대상자 등록
        </Link>
      </header>

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={filter.key === "all" ? "/clients" : `/clients?status=${filter.key}`}
            className={`rounded-full border px-4 py-1.5 text-base font-bold ${
              active === filter.key
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-ink-200 bg-white text-ink-600"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="bg-ink-50 text-sm font-bold text-ink-600">
                <th className="px-5 py-3">대상자</th>
                <th className="px-5 py-3">최근 통화</th>
                <th className="px-5 py-3">상태</th>
                <th className="px-5 py-3">주요 신호</th>
                <th className="px-5 py-3">안부전화 일정</th>
                <th className="px-5 py-3">동의</th>
                <th className="px-5 py-3">담당자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((row) => {
                const client = clientById.get(row.clientId);
                const schedule = client
                  ? `${client.call_schedule.days.map((d) => DAY_LABEL[d]).join("·")} ${client.call_schedule.time}`
                  : "-";
                return (
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
                    <td className="px-5 py-3 text-base text-ink-600">{schedule}</td>
                    <td className="px-5 py-3 text-base text-ink-600">
                      {client ? CONSENT_LABEL[client.consent_status] : "-"}
                    </td>
                    <td className="px-5 py-3 text-base text-ink-600">{row.workerName}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-base text-ink-500">
                    해당 상태의 대상자가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
