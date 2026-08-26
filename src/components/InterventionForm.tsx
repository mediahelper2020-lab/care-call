"use client";

import { useActionState } from "react";
import { recordInterventionAction, type FormState } from "@/app/actions";
import { INTERVENTION_LABEL } from "@/lib/labels";
import type { InterventionAction } from "@/lib/types";

const INITIAL: FormState = { ok: false, message: "" };

const ACTIONS = Object.keys(INTERVENTION_LABEL) as InterventionAction[];

export function InterventionForm({
  clientId,
  callId,
}: {
  clientId: string;
  callId: string | null;
}) {
  const [state, formAction, pending] = useActionState(recordInterventionAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      {callId ? <input type="hidden" name="callId" value={callId} /> : null}

      <div>
        <span className="label-text">조치 내용</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACTIONS.map((action, index) => (
            <label
              key={action}
              className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base font-semibold text-ink-700"
            >
              <input type="radio" name="action" value={action} defaultChecked={index === 0} />
              {INTERVENTION_LABEL[action]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="label-text" htmlFor="intervention-note">
          조치 결과
        </label>
        <textarea
          id="intervention-note"
          name="note"
          rows={3}
          className="field"
          placeholder="확인한 내용과 처리 결과를 남겨주세요."
        />
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
        {pending ? "기록 중…" : "후속조치 기록"}
      </button>
    </form>
  );
}
