import type { SignalCategory, TranscriptTurn } from "../types";
import { CLOSING, GREETING, pickNextQuestion } from "./questions";

/**
 * 대상자 응답 목록을 받아 한 통의 통화 전문을 만든다.
 * 질문은 직전 응답과 이미 물어본 항목을 참고해 매번 다르게 이어진다.
 */
export function buildTranscript(
  clientName: string,
  replies: string[],
  previousSummaries: string[] = [],
  startedAt: Date = new Date(),
): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  let clock = startedAt.getTime();
  const tick = () => {
    clock += 12000;
    return new Date(clock).toISOString();
  };

  turns.push({ speaker: "ai", text: GREETING(clientName), at: new Date(clock).toISOString() });

  const asked: SignalCategory[] = [];
  const followedUp: SignalCategory[] = [];
  let lastReply: string | null = null;

  for (const reply of replies) {
    const question = pickNextQuestion({
      clientName,
      askedCategories: asked,
      followedUpCategories: followedUp,
      lastClientUtterance: lastReply,
      previousSummaries,
    });
    if (question.category) {
      if (question.isFollowUp) followedUp.push(question.category);
      else asked.push(question.category);
    }
    turns.push({ speaker: "ai", text: question.text, at: tick() });
    turns.push({ speaker: "client", text: reply, at: tick() });
    lastReply = reply;
  }

  turns.push({ speaker: "ai", text: CLOSING, at: tick() });
  return turns;
}
