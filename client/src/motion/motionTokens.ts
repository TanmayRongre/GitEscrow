/**
 * GitEscrow — Hallmark-Aligned Motion Tokens
 * Maps directly to Console theme durations (--dur-micro, --dur-short, --dur-long)
 * and ease curves. All animations animate transforms and opacity only.
 */

export const MOTION_DUR = {
  micro: 0.12,     // 120ms: Interactive controls, button active drops, chip toggles
  short: 0.22,     // 220ms: Tab indicators, badge status updates, hover lifts
  med: 0.32,       // 320ms: Modal & panel entrances, section reveals
  long: 0.42,      // 420ms: Page-level cascade choreography
  exit: 0.16,      // 160ms: Snappy departures (60-70% of enter duration)
  stagger: 0.035,  // 35ms: Grid item stagger interval
} as const;

export const MOTION_EASE = {
  enter: 'power2.out',
  exit: 'power2.in',
  toggle: 'power2.inOut',
  crisp: 'power1.out',
  settle: 'power3.out',
} as const;

export const MOTION_DIST = {
  cardLiftY: -2,
  entranceY: 12,
  slideY: 8,
  modalStartScale: 0.97,
} as const;

