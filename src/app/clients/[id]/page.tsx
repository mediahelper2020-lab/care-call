import Link from "next/link";
import { notFound } from "next/navigation";
import { acknowledgeCallAction } from "@/app/actions";
import { ConsentForm } from "@/components/ConsentForm";
import { InterventionForm } from "@/components/InterventionForm";
import { RiskBadge } from "@/components/RiskBadge";
import { SimulationPanel } from "@/components/SimulationPanel";
import { canAccessClient, canViewTranscript, getCurrentUser } from "@/lib/auth";
import {
  isSameKstDay,
  kstDateLabel,
  kstDateTimeLabel,
  kstTimeLabel,
  relativeDayLabel,
} from "@/lib/datetime";
import {
  AI_DISCLAIMER,
  CATEGORY_LABEL,
  CONSENT_LABEL,
  DAY_LABEL,
  DETAIL_CATEGORIES,
  INTERVENTION_LABEL,
  RISK_LABEL,
  URGENT_NOTICE,
} from "@/lib/labels";
import { maskPhone } from "@/lib/privacy";
import { getTrends } from "@/lib/services/trends";
import { getStore } from "@/lib/store";
import { SCENARIOS } from "@/lib/telephony/scenarios";
import type { Call, CategoryFinding } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const store = getStore();

  const client = await store.getClient(id);
  if (!client) notFound();

  if (!canAccessClient(user, client)) {
    return (
      <div className="card p-8">
        <h1 className="text-xl font-extrabold text-ink-900">접근 권한이 없습니다</h1>
        <p className="mt-2 text-base text-ink-600">
          담당 사회복지사와 관리자만 이 대상자의 정보를 열람할 수 있습니다.
        </p>
        <Link href="/clients" className="btn-secondary mt-4">
          대상자 목록으로
        </Link>
      </div>
    );
  }

  const now = new Date();
  const [calls, interventions, users, trends] = await Promise.all([
    store.listCalls({ clientId: client.id }),
    store.listInterventions({ clientId: client.id }),
    store.listUsers(),
    getTrends(client.id, now),
  ]);

  const workerNames = new Map(users.map((u) => [u.id, u.name]));
  const todayCall = calls.find((call) => isSameKstDay(call.started_at, now)) ?? null;
  const lastContact = calls.find((call) => call.status === "completed") ?? null;
  const showTranscript = canViewTranscript(user, client);

  const scenarios = SCENARIOS.map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    headline: scenario.headline,
    expectedLabel: scenario.expected === "no_answer" ? "미응답" : RISK_LABEL[scenario.expected],
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/clients" className="text-base font-bold text-brand-700 hover:underline">
            ← 대상자 관리
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
              {client.name}
            </h1>
            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-sm font-bold text-ink-600">
              목록 표기 {client.masked_name}
            </span>
            {todayCall ? (
              <RiskBadge
                status={todayCall.status === "no_answer" ? "no_answer" : todayCall.risk_level}
              />
            ) : (
              <RiskBadge status="pending" />
            )}
          </div>
        </div>
      </header>

      {todayCall?.risk_level === "urgent" && todayCall.status === "completed" ? (
        <div className="rounded-xl border-2 border-alert-500/50 bg-alert-50 p-5">
          <p className="text-lg font-extrabold text-alert-700">{URGENT_NOTICE}</p>
          <p className="mt-1 text-base text-ink-700">
            AI 분석 결과만으로 긴급상황을 확정하지 말고 대상자 상태를 직접 확인해 주세요.
          </p>
          {!todayCall.acknowledged_by ? (
            <form action={acknowledgeCallAction} className="mt-3">
              <input type="hidden" name="callId" value={todayCall.id} />
              <button type="submit" className="btn-primary">
                확인했습니다
              </button>
            </form>
          ) : (
            <p className="mt-3 text-base font-bold text-ink-700">
              {workerNames.get(todayCall.acknowledged_by) ?? "담당자"} 확인 완료 ·{" "}
              {todayCall.acknowledged_at ? kstDateTimeLabel(todayCall.acknowledged_at) : ""}
            </p>
          )}
        </div>
      ) : null}

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-ink-900">기본정보</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="이름" value={client.name} />
          <Field
            label="담당 사회복지사"
            value={workerNames.get(client.assigned_worker) ?? "미지정"}
          />
          <Field label="연락처" value={maskPhone(client.phone)} />
          <Field label="보호자" value={client.guardian_name || "미등록"} />
          <Field
            label="보호자 연락처"
            value={client.guardian_phone ? maskPhone(client.guardian_phone) : "미등록"}
          />
          <Field
            label="안부전화 일정"
            value={`매주 ${client.call_schedule.days.map((d) => DAY_LABEL[d]).join("·")} ${client.call_schedule.time}`}
          />
          <Field
            label="최근 연락일"
            value={lastContact ? kstDateTimeLabel(lastContact.started_at) : "기록 없음"}
          />
          <Field label="동의 상태" value={CONSENT_LABEL[client.consent_status]} />
          <Field label="개인정보 보유기한" value={kstDateLabel(client.retention_until)} />
        </dl>
        {client.note ? (
          <p className="mt-4 rounded-lg bg-ink-50 px-4 py-3 text-base text-ink-700">{client.note}</p>
        ) : null}
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-ink-900">오늘의 AI 안부전화</h2>
          {todayCall ? (
            <span className="text-sm font-semibold text-ink-500">
              {kstTimeLabel(todayCall.started_at)} 발신
            </span>
          ) : null}
        </div>

        {!todayCall ? (
          <p className="mt-4 rounded-lg bg-ink-50 px-4 py-6 text-center text-base text-ink-600">
            오늘 안부전화 기록이 없습니다. 아래 시뮬레이션으로 통화를 진행할 수 있습니다.
          </p>
        ) : (
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-base font-bold text-ink-700">AI 요약</h3>
              <p className="mt-2 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-base leading-relaxed text-ink-800">
                {todayCall.ai_summary}
              </p>

              {showTranscript && todayCall.transcript.length > 0 ? (
                <details className="mt-4 rounded-lg border border-ink-200">
                  <summary className="cursor-pointer px-4 py-3 text-base font-bold text-ink-700">
                    통화 전문 보기 (담당자 전용)
                  </summary>
                  <ul className="space-y-2 border-t border-ink-100 px-4 py-3">
                    {todayCall.transcript.map((turn, index) => (
                      <li key={index} className="text-base">
                        <span className="font-bold text-ink-500">
                          {turn.speaker === "ai" ? "AI" : "대상자"}
                        </span>{" "}
                        <span className="text-ink-700">{turn.text}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : todayCall.transcript.length > 0 ? (
                <p className="mt-4 rounded-lg bg-ink-100 px-4 py-3 text-sm font-semibold text-ink-600">
                  통화 원문은 담당 사회복지사와 관리자만 열람할 수 있습니다.
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="text-base font-bold text-ink-700">AI 분석</h3>
              <AnalysisTable findings={todayCall.category_findings} overall={todayCall} />
              <p className="mt-3 rounded-lg bg-ink-100 px-3 py-2 text-sm font-semibold text-ink-600">
                {AI_DISCLAIMER}
              </p>
              <p className="mt-2 text-xs text-ink-400">
                판정 근거: {decidedByLabel(todayCall.decided_by)} · 분석 엔진 {todayCall.ai_provider}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-ink-900">후속조치 기록</h2>
        <p className="mt-1 text-base text-ink-500">
          확인 결과를 기록하면 사례관리 이력으로 남고, 관련 알림은 확인 처리됩니다.
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <InterventionForm clientId={client.id} callId={todayCall?.id ?? null} />
          <div>
            <h3 className="text-base font-bold text-ink-700">조치 이력</h3>
            {interventions.length === 0 ? (
              <p className="mt-2 rounded-lg bg-ink-50 px-4 py-6 text-center text-base text-ink-500">
                기록된 후속조치가 없습니다.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-ink-100 rounded-lg border border-ink-200">
                {interventions.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">
                        {INTERVENTION_LABEL[item.action]}
                      </span>
                      <span className="text-sm text-ink-500">
                        {kstDateTimeLabel(item.created_at)} · {workerNames.get(item.worker_id) ?? "담당자"}
                      </span>
                    </div>
                    {item.note ? <p className="mt-1 text-base text-ink-700">{item.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-ink-900">변화 추이</h2>
        <p className="mt-1 text-base text-ink-500">최근 7일과 30일 기록을 비교했습니다.</p>

        <ul className="mt-4 space-y-2">
          {trends.messages.map((message) => (
            <li
              key={message}
              className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-base font-semibold text-brand-700"
            >
              {message}
            </li>
          ))}
        </ul>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="bg-ink-50 text-sm font-bold text-ink-600">
                <th className="px-4 py-2">항목</th>
                <th className="px-4 py-2">최근 7일</th>
                <th className="px-4 py-2">직전 7일</th>
                <th className="px-4 py-2">최근 30일</th>
                <th className="px-4 py-2">변화</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {trends.items.map((item) => (
                <tr key={item.category}>
                  <td className="px-4 py-2 text-base font-semibold text-ink-700">{item.label}</td>
                  <td className="px-4 py-2 text-base text-ink-600">{item.last7}회</td>
                  <td className="px-4 py-2 text-base text-ink-600">{item.previous7}회</td>
                  <td className="px-4 py-2 text-base text-ink-600">{item.last30}회</td>
                  <td className="px-4 py-2 text-base font-bold">
                    {item.direction === "up" ? (
                      <span className="text-watch-700">증가</span>
                    ) : item.direction === "down" ? (
                      <span className="text-safe-700">감소</span>
                    ) : (
                      <span className="text-ink-400">변화 없음</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-ink-50/60">
                <td className="px-4 py-2 text-base font-semibold text-ink-700">통화 응답률</td>
                <td className="px-4 py-2 text-base text-ink-600">{trends.responseRate7}%</td>
                <td className="px-4 py-2 text-base text-ink-400">-</td>
                <td className="px-4 py-2 text-base text-ink-600">{trends.responseRate30}%</td>
                <td className="px-4 py-2 text-base text-ink-400">
                  {trends.callCount30}건 중 응답
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-ink-900">최근 통화 이력</h2>
        <ul className="mt-4 divide-y divide-ink-100">
          {calls.slice(0, 10).map((call) => (
            <li key={call.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-24 text-base font-semibold text-ink-600">
                {relativeDayLabel(call.started_at, now)}
              </span>
              <span className="text-base text-ink-500">{kstTimeLabel(call.started_at)}</span>
              <RiskBadge
                status={call.status === "no_answer" ? "no_answer" : call.risk_level}
                size="sm"
              />
              <span className="flex-1 text-base text-ink-700">{call.ai_summary}</span>
            </li>
          ))}
        </ul>
      </section>

      <SimulationPanel
        clients={[
          {
            id: client.id,
            maskedName: client.masked_name,
            workerName: workerNames.get(client.assigned_worker) ?? "미지정",
          },
        ]}
        scenarios={scenarios}
        defaultClientId={client.id}
      />

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-ink-900">개인정보 처리 동의</h2>
        <p className="mt-1 text-base text-ink-500">
          동의가 확인되지 않으면 안부전화를 진행할 수 없습니다.
        </p>
        <div className="mt-4">
          <ConsentForm
            clientId={client.id}
            consentStatus={client.consent_status}
            recordingConsent={client.recording_consent}
          />
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-bold text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold text-ink-800">{value}</dd>
    </div>
  );
}

function AnalysisTable({ findings, overall }: { findings: CategoryFinding[]; overall: Call }) {
  const byCategory = new Map(findings.map((f) => [f.category, f]));
  const rows = DETAIL_CATEGORIES.map(
    (category) =>
      byCategory.get(category) ?? { category, level: "normal" as const, note: "특이사항 없음" },
  );

  return (
    <dl className="mt-2 divide-y divide-ink-100 rounded-lg border border-ink-200">
      {rows.map((finding) => (
        <div key={finding.category} className="flex items-start justify-between gap-3 px-4 py-2.5">
          <dt className="text-base font-semibold text-ink-600">{CATEGORY_LABEL[finding.category]}</dt>
          <dd className="text-right">
            <span
              className={`text-base font-bold ${
                finding.level === "urgent"
                  ? "text-alert-700"
                  : finding.level === "attention"
                    ? "text-watch-700"
                    : "text-ink-500"
              }`}
            >
              {finding.level === "normal" ? "정상" : RISK_LABEL[finding.level]}
            </span>
            {finding.level !== "normal" ? (
              <span className="block text-sm text-ink-500">{finding.note}</span>
            ) : null}
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 bg-ink-50 px-4 py-3">
        <dt className="text-base font-extrabold text-ink-700">종합</dt>
        <dd>
          <RiskBadge
            status={overall.status === "no_answer" ? "no_answer" : overall.risk_level}
            size="sm"
          />
        </dd>
      </div>
    </dl>
  );
}

function decidedByLabel(decidedBy: Call["decided_by"]): string {
  switch (decidedBy) {
    case "rule":
      return "규칙 기반 탐지";
    case "ai":
      return "AI 문맥 분석";
    case "both":
      return "규칙 기반 탐지 + AI 문맥 분석";
    default:
      return "위험 신호 없음";
  }
}
