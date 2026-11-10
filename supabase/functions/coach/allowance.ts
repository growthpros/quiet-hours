// The beta allowance, enforced on the server. The same numbers and rule as
// client/src/lib/coach-allowance.ts (the app's copy, which explains them);
// coach-allowance.test.ts fails if the two drift apart.

export const DAILY_MESSAGES = 40;
export const FINISH_EXTRA = 10;

export function canSend(sentToday: number, continuing: boolean): boolean {
  if (sentToday < DAILY_MESSAGES) return true;
  return continuing && sentToday < DAILY_MESSAGES + FINISH_EXTRA;
}
