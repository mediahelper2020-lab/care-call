"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { simulateCallAction, type SimulationState } from "@/app/actions";
import { RiskBadge } from "@/components/RiskBadge";
import { AI_DISCLAIMER, CATEGORY_LABEL, RISK_LABEL, URGENT_NOTICE } from "@/lib/labels";
import type { SignalCategory } from "@/lib/types";

export interface SimulationClientOption {
  id: string;
  maskedName: string;
  workerName: string;
}

export interface SimulationScenarioOption {
  id: string;
  label: string;
  headline: string;
  expectedLabel: string;
}

const INITIAL: SimulationState = { ok: false, message: "" };

export function SimulationPanel({
  clients,
  scenarios,
  defaultClientId,
}: {
  clients: SimulationClientOption[];
  scenarios: SimulationScenarioOption[];
  defaultClientId?: string;
}) {
  const [state, formAction, pending] = useActionState(simulateCallAction, INITIAL);
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "normal");
  const [visibleTurns, setVisibleTurns] = useState(0);

  const transcript = state.result?.transcript ?? [];
  const callId = state.result?.callId;

  useEffect(() => {
    if (transcript.length === 0) {
      setVisibleTurns(0);
      return;
    }
    setVisibleTurns(1);
    const timer = setInterval(() => {
      setVisibleTurns((current) => {
        if (current >= transcript.length) {
          clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, 450);
    return () => clearInterval(timer);
  }, [callId, transcript.length]);

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink-900">AI 안부전화 시뮬레이션</h2>
          <p className="mt-1 text-base text-ink-500">
            실제 전화 API 연결 전, 가상의 통화내용으로 서비스 전체 흐름을 시연합니다.
          </p>
        </div>
        <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
          가상 통화 모드
        </span>
      </div>

      <form action={formAction} className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div>
          <label className="label-text" htmlFor="sim-client">
            돌봄 대상자
          </label>
          <select
            id="sim-client"
            name="clientId"
            defaultValue={defaultClientId ?? clients[0]?.id}
            className="field"
            required
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.maskedName} · 담당 {client.workerName}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-ink-500">
            목록에서는 개인정보 보호를 위해 이름을 마스킹해 표시합니다.
          </p>
        </div>

        <div>
          <span className="label-text">통화 시나리오</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {scenarios.map((scenario) => (
              <label
                key={scenario.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 ${
                  scenarioId === scenario.id
                    ? "border-brand-500 bg-brand-50"
                    : "border-ink-200 bg-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scenarioId"
                    value={scenario.id}
                    checked={scenarioId === scenario.id}
                    onChange={() => setScenarioId(scenario.id)}
                  />
                  <span className="font-bold text-ink-800">{scenario.label}</span>
                </span>
                <span className="pl-6 text-sm text-ink-500">&ldquo;{scenario.headline}&rdquo;</span>
                <span className="pl-6 text-sm font-semibold text-ink-600">
                  예상 판정: {scenario.expectedLabel}
                </span>
              </label>
            ))}
            <label
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 ${
                scenarioId === "custom" ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-white"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scenarioId"
                  value="custom"
                  checked={scenarioId === "custom"}
                  onChange={() => setScenarioId("custom")}
                />
                <span className="font-bold text-ink-800">직접 입력</span>
              </span>
              <span className="pl-6 text-sm text-ink-500">대상자 발언을 직접 작성해 분석합니다.</span>
            </label>
          </div>

          {scenarioId === "custom" ? (
            <div className="mt-3">
              <label className="label-text" htmlFor="custom-replies">
                대상자 발언 (한 줄에 하나씩)
              </label>
              <textarea
                id="custom-replies"
                name="customReplies"
                rows={4}
                className="field"
                placeholder={"오늘은 아무것도 못 먹었어요.\n어제 밤에 잠을 못 잤어요."}
              />
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={pending}>
            {pending ? "AI 안부전화 진행 중…" : "AI 안부전화 시작"}
          </button>
        </div>
      </form>

      {state.message && !state.ok ? (
        <p className="mt-4 rounded-lg border border-alert-500/30 bg-alert-50 px-4 py-3 text-base font-semibold text-alert-700">
          {state.message}
        </p>
      ) : null}

      {state.result ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
            <h3 className="text-base font-bold text-ink-700">통화 내용</h3>
            {transcript.length === 0 ? (
              <p className="mt-3 text-base text-ink-600">
                전화를 받지 않아 통화가 이루어지지 않았습니다.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {transcript.slice(0, visibleTurns).map((turn, index) => (
                  <li
                    key={`${index}-${turn.text}`}
                    className={`max-w-[92%] rounded-lg px-3 py-2 text-base ${
                      turn.speaker === "ai"
                        ? "border border-ink-200 bg-white text-ink-700"
                        : "ml-auto bg-brand-600 text-white"
                    }`}
                  >
                    <span className="block text-xs font-bold opacity-70">
                      {turn.speaker === "ai" ? "AI 안부전화" : "대상자"}
                    </span>
                    {turn.text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-ink-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-ink-700">AI 분석 결과</h3>
              <RiskBadge
                status={state.result.status === "no_answer" ? "no_answer" : state.result.riskLevel}
              />
            </div>

            {state.result.riskLevel === "urgent" ? (
              <p className="mt-3 rounded-lg border border-alert-500/40 bg-alert-50 px-3 py-2 text-base font-bold text-alert-700">
                {URGENT_NOTICE}
              </p>
            ) : null}

            <p className="mt-3 text-base leading-relaxed text-ink-700">{state.result.summary}</p>

            {state.result.categories.length > 0 ? (
              <dl className="mt-4 divide-y divide-ink-100 border-t border-ink-100">
                {state.result.categories.map((finding) => (
                  <div key={finding.category} className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-base font-semibold text-ink-600">
                      {CATEGORY_LABEL[finding.category as SignalCategory] ?? finding.category}
                    </dt>
                    <dd className="text-base font-bold">
                      <span
                        className={
                          finding.level === "urgent"
                            ? "text-alert-700"
                            : finding.level === "attention"
                              ? "text-watch-700"
                              : "text-ink-500"
                        }
                      >
                        {finding.level === "normal" ? "특이사항 없음" : RISK_LABEL[finding.level]}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <p className="mt-4 rounded-lg bg-ink-100 px-3 py-2 text-sm font-semibold text-ink-600">
              {AI_DISCLAIMER}
            </p>

            {state.result.notified ? (
              <p className="mt-2 text-sm font-semibold text-brand-700">
                담당 사회복지사에게 알림을 보냈습니다.
              </p>
            ) : null}

            <div className="mt-4">
              <Link href={`/clients/${state.result.clientId}`} className="btn-primary">
                대상자 상세에서 후속조치 기록
              </Link>
            </div>
            <p className="mt-3 text-xs text-ink-400">
              분석 엔진: 규칙 기반 탐지 + {state.result.provider} 문맥 분석
              {state.result.simulated ? " · 가상 통화 시뮬레이션" : ""}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
