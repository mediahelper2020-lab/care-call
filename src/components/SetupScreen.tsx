"use client";

import { useActionState } from "react";
import { resetDataAction, seedDemoDataAction, type FormState } from "@/app/actions";
import type { SetupStatus } from "@/lib/store/supabase-setup";

const INITIAL: FormState = { ok: false, message: "" };

function StatusRow({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <li className="flex gap-3 border-b border-ink-100 px-4 py-3 last:border-b-0">
      <span
        aria-hidden
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? "bg-safe-50 text-safe-700" : "bg-watch-50 text-watch-700"
        }`}
      >
        {done ? "✓" : "!"}
      </span>
      <span>
        <span className="block text-base font-bold text-ink-800">{label}</span>
        <span className="block text-base text-ink-600">{detail}</span>
      </span>
    </li>
  );
}

export function SetupScreen({ status }: { status: SetupStatus }) {
  const [seedState, seedAction, seeding] = useActionState(seedDemoDataAction, INITIAL);
  const [resetState, resetFormAction, resetting] = useActionState(resetDataAction, INITIAL);

  const hasData = status.counts.clients > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <header>
        <p className="text-base font-bold text-brand-700">AI 안심돌봄 · 최초 설정</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
          서비스를 사용할 준비를 마칩니다
        </h1>
        <p className="mt-2 text-base text-ink-600">
          아래 항목이 모두 완료되면 대시보드가 열립니다.
        </p>
      </header>

      <ul className="card overflow-hidden">
        <StatusRow
          done={status.configured}
          label="1. Supabase 연결 정보"
          detail={
            status.configured
              ? "환경변수가 설정되어 있습니다."
              : "NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해 주세요."
          }
        />
        <StatusRow
          done={status.tablesReady}
          label="2. 데이터베이스 표 만들기"
          detail={
            status.tablesReady
              ? "표가 준비되어 있습니다."
              : "Supabase의 SQL Editor에서 supabase/schema.sql 파일 내용을 붙여넣고 실행해 주세요."
          }
        />
        <StatusRow
          done={hasData}
          label="3. 초기 데이터 넣기"
          detail={
            hasData
              ? `대상자 ${status.counts.clients}명, 통화기록 ${status.counts.calls}건이 저장되어 있습니다.`
              : "아래 버튼을 누르면 시연용 대상자와 통화 이력이 만들어집니다."
          }
        />
        <StatusRow
          done={status.encryptionKeyReady}
          label="4. 개인정보 암호화 키"
          detail={
            status.encryptionKeyReady
              ? "운영용 암호화 키가 설정되어 있습니다."
              : "CARE_ENCRYPTION_KEY가 없어 개발 전용 키로 동작합니다. 실제 개인정보를 입력하지 마세요."
          }
        />
      </ul>

      {status.error ? (
        <p className="rounded-lg border border-alert-500/30 bg-alert-50 px-4 py-3 text-base font-semibold text-alert-700">
          {status.error}
        </p>
      ) : null}

      {status.tablesReady ? (
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-ink-900">시연용 초기 데이터</h2>
          <p className="mt-1 text-base text-ink-600">
            대상자 124명과 최근 30일 통화 이력을 넣습니다. 넣은 뒤에도 대상자를 직접 등록할 수 있습니다.
          </p>
          <form action={seedAction} className="mt-4">
            <button type="submit" className="btn-primary" disabled={seeding || hasData}>
              {seeding ? "저장 중…" : hasData ? "이미 저장되어 있습니다" : "초기 데이터 넣기"}
            </button>
          </form>
          {seedState.message ? (
            <p
              className={`mt-3 rounded-lg px-4 py-3 text-base font-semibold ${
                seedState.ok
                  ? "border border-safe-500/30 bg-safe-50 text-safe-700"
                  : "border border-alert-500/30 bg-alert-50 text-alert-700"
              }`}
            >
              {seedState.message}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-ink-900">데이터베이스 표 만드는 방법</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-base text-ink-700">
            <li>Supabase 프로젝트 화면 왼쪽에서 <b>SQL Editor</b>를 엽니다.</li>
            <li>
              저장소의 <code className="rounded bg-ink-100 px-1.5 py-0.5 text-sm">supabase/schema.sql</code>{" "}
              파일을 열어 전체 내용을 복사합니다.
            </li>
            <li>SQL Editor에 붙여넣고 <b>Run</b>을 누릅니다.</li>
            <li>이 화면을 새로고침합니다.</li>
          </ol>
        </section>
      )}

      {status.tablesReady && hasData ? (
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-ink-900">데이터 전체 삭제</h2>
          <p className="mt-1 text-base text-ink-600">
            저장된 모든 대상자와 통화기록을 지웁니다. 되돌릴 수 없습니다.
          </p>
          <form action={resetFormAction} className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label-text" htmlFor="reset-confirm">
                확인을 위해 &lsquo;삭제&rsquo;라고 입력
              </label>
              <input id="reset-confirm" name="confirm" className="field sm:w-40" autoComplete="off" />
            </div>
            <button type="submit" className="btn-secondary" disabled={resetting}>
              {resetting ? "삭제 중…" : "전체 삭제"}
            </button>
          </form>
          {resetState.message ? (
            <p
              className={`mt-3 rounded-lg px-4 py-3 text-base font-semibold ${
                resetState.ok
                  ? "border border-safe-500/30 bg-safe-50 text-safe-700"
                  : "border border-alert-500/30 bg-alert-50 text-alert-700"
              }`}
            >
              {resetState.message}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
