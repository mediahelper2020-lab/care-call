import { purgeExpiredAction } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { kstDateTimeLabel } from "@/lib/datetime";
import { isProductionKeyConfigured, retentionDays } from "@/lib/privacy";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const MEASURES = [
  {
    title: "최소 수집",
    detail: "안부 확인에 필요한 이름·연락처·보호자 연락처·일정만 수집합니다.",
  },
  {
    title: "저장 시 암호화",
    detail: "이름과 연락처, 통화 전문은 AES-256-GCM으로 암호화해 보관합니다.",
  },
  {
    title: "접근권한 관리",
    detail: "관리자와 담당 사회복지사만 대상자 정보를 열람할 수 있습니다.",
  },
  {
    title: "통화내용 접근 제한",
    detail: "통화 원문은 담당자와 관리자에게만 공개하고, 그 외에는 요약만 제공합니다.",
  },
  {
    title: "목록 마스킹",
    detail: "대시보드와 목록 화면에서는 이름을 마스킹해 표시합니다.",
  },
  {
    title: "동의 관리",
    detail: "동의가 확인되지 않은 대상자에게는 안부전화를 진행하지 않습니다.",
  },
  {
    title: "보유기간 관리",
    detail: "보유기간이 지난 개인정보는 통화기록과 함께 삭제합니다.",
  },
  {
    title: "활동 로그",
    detail: "대상자 등록, 통화 실행, 후속조치 기록 등 주요 활동을 기록합니다.",
  },
];

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  const store = getStore();
  const [clients, logs] = await Promise.all([store.listClients(), store.listAuditLogs(30)]);

  const now = new Date().toISOString();
  const expired = clients.filter((c) => c.retention_until <= now).length;
  const consentPending = clients.filter((c) => c.consent_status !== "granted").length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          개인정보 보호
        </h1>
        <p className="mt-1 text-base text-ink-500">
          개인정보 보호를 서비스 핵심 기능으로 관리합니다. 실제 배포 전에는 관련 법적 요건을 별도로
          검토해야 합니다.
        </p>
      </header>

      {!isProductionKeyConfigured() ? (
        <p className="rounded-lg border border-watch-500/40 bg-watch-50 px-4 py-3 text-base font-semibold text-watch-700">
          운영용 암호화 키(CARE_ENCRYPTION_KEY)가 설정되지 않아 개발 전용 키로 동작 중입니다. 실제
          개인정보를 입력하지 마세요.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-bold text-ink-500">보유기간 설정</p>
          <p className="mt-1 text-3xl font-extrabold text-ink-900">
            {retentionDays()}
            <span className="ml-1 text-lg">일</span>
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-ink-500">보유기간 만료 대상</p>
          <p className="mt-1 text-3xl font-extrabold text-ink-900">
            {expired}
            <span className="ml-1 text-lg">명</span>
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-bold text-ink-500">동의 미완료</p>
          <p className="mt-1 text-3xl font-extrabold text-ink-900">
            {consentPending}
            <span className="ml-1 text-lg">명</span>
          </p>
        </div>
      </section>

      {user.role === "admin" ? (
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-ink-900">보유기간 만료 데이터 삭제</h2>
          <p className="mt-1 text-base text-ink-500">
            보유기간이 지난 대상자의 개인정보와 통화기록을 즉시 삭제합니다. 되돌릴 수 없습니다.
          </p>
          <form action={purgeExpiredAction} className="mt-3">
            <button type="submit" className="btn-secondary">
              만료 데이터 삭제 실행
            </button>
          </form>
        </section>
      ) : null}

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-ink-900">적용된 보호 조치</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {MEASURES.map((measure) => (
            <li key={measure.title} className="rounded-lg border border-ink-200 px-4 py-3">
              <p className="text-base font-bold text-ink-800">{measure.title}</p>
              <p className="mt-0.5 text-base text-ink-600">{measure.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-ink-200 px-5 py-3">
          <h2 className="text-lg font-extrabold text-ink-900">관리자 활동 로그</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="bg-ink-50 text-sm font-bold text-ink-600">
                <th className="px-5 py-3">시각</th>
                <th className="px-5 py-3">수행자</th>
                <th className="px-5 py-3">활동</th>
                <th className="px-5 py-3">내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-2.5 text-base text-ink-600">
                    {kstDateTimeLabel(log.created_at)}
                  </td>
                  <td className="px-5 py-2.5 text-base font-semibold text-ink-700">
                    {log.actor_name}
                  </td>
                  <td className="px-5 py-2.5 text-base text-ink-600">{log.action}</td>
                  <td className="px-5 py-2.5 text-base text-ink-600">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
