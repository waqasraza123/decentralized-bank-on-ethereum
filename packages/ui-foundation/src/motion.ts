export const motionDurations = {
  fastMs: 160,
  enterMs: 360,
  heroMs: 520,
  ambientMs: 24000
} as const;

export const motionDelays = {
  staggerMs: 36,
  sectionMs: 80,
  heroMs: 120
} as const;

export const motionDistance = {
  soft: 6,
  medium: 10,
  strong: 14
} as const;

export const motionProfiles = {
  customer: {
    easing: [0.16, 1, 0.3, 1] as const,
    hoverScale: 1.004,
    hoverLift: -2,
    pressScale: 0.994
  },
  admin: {
    easing: [0.2, 0.96, 0.34, 1] as const,
    hoverScale: 1.002,
    hoverLift: -1,
    pressScale: 0.996
  },
  mobile: {
    damping: 24,
    stiffness: 140,
    pressScale: 0.985
  }
} as const;

export const motionAdminMultiplier = 0.82;
