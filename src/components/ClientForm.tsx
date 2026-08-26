"use client";

import { useActionState } from "react";
import { createClientAction, type FormState } from "@/app/actions";
import { DAY_LABEL } from "@/lib/labels";

const INITIAL: FormState = { ok: false, message: "" };

export function ClientForm({
  workers,
  defaultWorkerId,
}: {
  workers: { id: string; name: string }[];
  defaultWorkerId: string;
}) {
  const [state, formAction, pending] = useActionState(createClientAction, INITIAL);

  return (
    <form action={formAction} className="card space-y-6 p-5 sm:p-6">
      <fieldset className="space-y-4">
        <legend className="text-lg font-extrabold text-ink-900">기본정보</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-text" htmlFor="name">
              이름 <span className="text-alert-600">*</span>
            </label>
            <input id="name" name="name" className="field" required autoComplete="off" />
            <p className="mt-1 text-sm text-ink-500">목록 화면에는 마스킹된 이름으로 표시됩니다.</p>
          </div>
          <div>
            <label className="label-text" htmlFor="phone">
              연락처 <span className="text-alert-600">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              className="field"
              required
              placeholder="010-0000-0000"
              inputMode="tel"
            />
          </div>
          <div>
            <label className="label-text" htmlFor="birth_year">
              출생연도
            </label>
            <input
              id="birth_year"
              name="birth_year"
              className="field"
              inputMode="numeric"
              placeholder="1940"
            />
          </div>
          <div>
            <label className="label-text" htmlFor="assigned_worker">
              담당 사회복지사
            </label>
            <select
              id="assigned_worker"
              name="assigned_worker"
              className="field"
              defaultValue={defaultWorkerId}
            >
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-extrabold text-ink-900">보호자</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-text" htmlFor="guardian_name">
              보호자 이름·관계
            </label>
            <input id="guardian_name" name="guardian_name" className="field" placeholder="김지훈(장남)" />
          </div>
          <div>
            <label className="label-text" htmlFor="guardian_phone">
              보호자 연락처
            </label>
            <input id="guardian_phone" name="guardian_phone" className="field" inputMode="tel" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-extrabold text-ink-900">안부전화 일정</legend>
        <div>
          <span className="label-text">요일</span>
          <div className="flex flex-wrap gap-2">
            {DAY_LABEL.map((label, index) => (
              <label
                key={label}
                className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-base font-semibold"
              >
                <input
                  type="checkbox"
                  name="schedule_days"
                  value={index}
                  defaultChecked={[1, 3, 5].includes(index)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="sm:w-48">
          <label className="label-text" htmlFor="schedule_time">
            발신 시각
          </label>
          <input
            id="schedule_time"
            name="schedule_time"
            type="time"
            className="field"
            defaultValue="09:00"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-extrabold text-ink-900">개인정보 처리 동의</legend>
        <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-600">
          안부전화는 통화 내용을 문자로 변환해 AI가 분석합니다. 수집 항목과 보유기간을 대상자에게 안내하고
          동의를 받은 뒤 등록해 주세요. 동의가 확인되지 않으면 안부전화를 진행할 수 없습니다.
        </p>
        <div>
          <label className="label-text" htmlFor="consent_status">
            동의 상태
          </label>
          <select id="consent_status" name="consent_status" className="field sm:w-64" defaultValue="pending">
            <option value="pending">동의 대기</option>
            <option value="granted">동의 완료</option>
            <option value="withdrawn">동의 철회</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-base font-semibold text-ink-700">
          <input type="checkbox" name="recording_consent" defaultChecked />
          통화 내용 기록 및 AI 처리에 대한 고지·동의를 받았습니다.
        </label>
      </fieldset>

      <div>
        <label className="label-text" htmlFor="note">
          특이사항
        </label>
        <textarea id="note" name="note" rows={3} className="field" />
      </div>

      {state.message ? (
        <p
          className={`rounded-lg px-4 py-3 text-base font-semibold ${
            state.ok
              ? "border border-safe-500/30 bg-safe-50 text-safe-700"
              : "border border-alert-500/30 bg-alert-50 text-alert-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "등록 중…" : "대상자 등록"}
      </button>
    </form>
  );
}
