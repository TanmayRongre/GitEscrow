import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MOTION_DUR, MOTION_EASE } from './motionTokens';

// Centralized GSAP plugin registration
gsap.registerPlugin(useGSAP);

// Project-wide defaults aligned with Hallmark's modern-minimal Console theme
gsap.defaults({
  duration: MOTION_DUR.short,
  ease: MOTION_EASE.enter,
  overwrite: 'auto',
});

/**
 * Checks whether user has enabled prefers-reduced-motion in browser/OS.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { gsap, useGSAP };

