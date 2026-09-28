import type { Goal } from '../db/schema'

/**
 * v1 product scope (docs/design/evie/DECISIONS.md, A4 and O2).
 * The code behind a disabled flag stays in the repo, so turning it back on is
 * a one-line change, but no entry point is shown.
 */
export const FEATURES = {
  /** Cloud AI assistant. Off: v1 ships no AI; any future AI is on-device only. */
  assistant: false,
  /** Trying-to-conceive mode. */
  ttcMode: false,
  /** Perimenopause mode. */
  perimenopauseMode: false,
  /** Encrypted cloud backup (the relay code is reused for partner sync). */
  cloudBackup: false,
} as const

const GOAL_FLAGS: Record<Goal, boolean> = {
  cycle: true,
  pregnancy: true,
  ttc: FEATURES.ttcMode,
  peri: FEATURES.perimenopauseMode,
}

/** Goals offered in onboarding and Settings. A goal already saved stays visible. */
export function isGoalOffered(goal: Goal, current?: Goal): boolean {
  return GOAL_FLAGS[goal] || goal === current
}
