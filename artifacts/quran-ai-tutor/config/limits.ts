/**
 * Free-tier usage limits.
 * Override via env: EXPO_PUBLIC_FREE_DAILY_AI_CALLS=20
 */
export const FREE_DAILY_AI_CALLS = Number(
  process.env.EXPO_PUBLIC_FREE_DAILY_AI_CALLS ?? "10"
);