// The coach's daily allowance for the beta (Caroline's decision, Nov 9).
//
//   - 40 messages per person per day, reset at their own midnight.
//   - A gentle note from 30 on, so nobody is surprised.
//   - At 40, a conversation already under way can carry on for up to 10
//     more messages, so nobody is cut off mid-way. A new conversation waits
//     for tomorrow.
//   - The crisis resources on the page are never limited.
//
// The coach function (supabase/functions/coach) enforces the same numbers on
// the server; coach-allowance.test.ts fails if the two copies drift apart.
// Only the count is stored (coach_usage, migration 019), never content.

export const DAILY_MESSAGES = 40;
export const HEADS_UP_AT = 30;
export const FINISH_EXTRA = 10;

/** Whether one more message can go to the coach. */
export function canSend(sentToday: number, continuing: boolean): boolean {
  if (sentToday < DAILY_MESSAGES) return true;
  return continuing && sentToday < DAILY_MESSAGES + FINISH_EXTRA;
}

/** The note under the message box, or null when there's nothing to say. */
export function allowanceNote(sentToday: number, continuing: boolean): string | null {
  if (sentToday < HEADS_UP_AT) return null;
  if (sentToday < DAILY_MESSAGES) {
    const left = DAILY_MESSAGES - sentToday;
    return `You've got ${left} message${left === 1 ? "" : "s"} left today. They reset at midnight.`;
  }
  if (canSend(sentToday, continuing)) {
    return "That's today's 40. You can keep going with this conversation for a little while, and a new one can start after midnight.";
  }
  return "That's all the coach messages for today. They reset at midnight. The crisis resources above are always here.";
}
