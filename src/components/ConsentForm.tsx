"use client";

import { useActionState } from "react";
import { updateConsentAction, type FormState } from "@/app/actions";
import type { ConsentStatus } from "@/lib/types";

const INITIAL: FormState = { ok: false, message: "" };

export function ConsentForm({
  clientId,
  consentStatus,
  recordingConsent,
}: {
  clientId: string;
  consentStatus: ConsentStatus;
  recordingConsent: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateConsentAction, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="sm:w-56">
        <label className="label-text" htmlFor="consent-status">
          개인정보 처리 동의
        </label>
        <select
          id="consent-status"
          name="consent_status"
          className="field"
          defaultValue={consentStatus}
        >
          <option value="pending">동의 대기</option>
          <option value="granted">동의 완료</option>
          <option value="withdrawn">동의 철회</option>
        </select>
      </div>
      <label className="flex items-center gap-2 text-base font-semibold text-ink-700">
        <input type="checkbox" name="recording_consent" defaultChecked={recordingConsent} />
        통화 내용 기록 및 AI 처리 고지·동의 완료
      </label>
      {state.message ? (
        <p className="text-base font-semibold text-safe-700">{state.message}</p>
      ) : null}
      <button type="submit" className="btn-secondary" disabled={pending}>
        {pending ? "저장 중…" : "동의 상태 저장"}
      </button>
    </form>
  );
}
