import { gsap, prefersReducedMotion } from "./gsapSetup";
import { MOTION_DUR, MOTION_EASE, MOTION_DIST } from "./motionTokens";

/**
 * Staggered entrance for card grids (e.g., BountyList).
 * Limits staggered animation to visible viewport items to ensure 60 FPS performance.
 */
export function animateGridEntrance(
  selector: string | Element[],
  containerRef?: Element | null,
  onComplete?: () => void,
) {
  const reduced = prefersReducedMotion();
  const elements =
    typeof selector === "string" && containerRef
      ? containerRef.querySelectorAll(selector)
      : selector;

  if (reduced) {
    return gsap.set(elements, {
      autoAlpha: 1,
      y: 0,
      clearProps: "transform,opacity,visibility",
    });
  }

  return gsap.fromTo(
    elements,
    { autoAlpha: 0, y: MOTION_DIST.entranceY },
    {
      autoAlpha: 1,
      y: 0,
      duration: MOTION_DUR.short,
      stagger: {
        each: MOTION_DUR.stagger,
        from: "start",
      },
      ease: MOTION_EASE.enter,
      clearProps: "transform,opacity,visibility",
      onComplete,
    },
  );
}

/**
 * Micro-interaction for hover lift on bounty cards.
 * Operates purely on compositor translate (y), never margins or offsets.
 */
export function animateCardHover(target: Element, isHovered: boolean) {
  if (prefersReducedMotion()) return;

  gsap.to(target, {
    y: isHovered ? MOTION_DIST.cardLiftY : 0,
    duration: MOTION_DUR.micro,
    ease: MOTION_EASE.crisp,
    overwrite: "auto",
  });
}

/**
 * Modal dialog reveal animation.
 * Backdrop fades; modal card scales 0.97 -> 1.0 with subtle settling.
 */
export function animateModalEnter(
  backdropEl: Element | null,
  cardEl: Element | null,
  onComplete?: () => void,
) {
  if (!backdropEl || !cardEl) return;
  const reduced = prefersReducedMotion();

  if (reduced) {
    gsap.set([backdropEl, cardEl], { autoAlpha: 1, scale: 1, y: 0 });
    onComplete?.();
    return;
  }

  const tl = gsap.timeline({ onComplete });
  tl.fromTo(
    backdropEl,
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: MOTION_DUR.short, ease: MOTION_EASE.crisp },
  ).fromTo(
    cardEl,
    { autoAlpha: 0, scale: MOTION_DIST.modalStartScale, y: MOTION_DIST.slideY },
    {
      autoAlpha: 1,
      scale: 1,
      y: 0,
      duration: MOTION_DUR.med,
      ease: MOTION_EASE.settle,
    },
    "<", // concurrent start
  );

  return tl;
}

/**
 * Modal dialog dismissal animation.
 * Quick exit at ~65% enter duration.
 */
export function animateModalExit(
  backdropEl: Element | null,
  cardEl: Element | null,
  onComplete?: () => void,
) {
  if (!backdropEl || !cardEl) {
    onComplete?.();
    return;
  }
  const reduced = prefersReducedMotion();

  if (reduced) {
    gsap.set([backdropEl, cardEl], { autoAlpha: 0 });
    onComplete?.();
    return;
  }

  const tl = gsap.timeline({ onComplete });
  tl.to(cardEl, {
    autoAlpha: 0,
    scale: MOTION_DIST.modalStartScale,
    duration: MOTION_DUR.exit,
    ease: MOTION_EASE.exit,
  }).to(
    backdropEl,
    { autoAlpha: 0, duration: MOTION_DUR.exit, ease: MOTION_EASE.exit },
    "<",
  );

  return tl;
}

/**
 * Crossfade between view tabs (e.g., Bounty Details vs Milestones vs Ledger).
 */
export function animateTabTransition(
  containerEl: Element | null,
  onComplete?: () => void,
) {
  if (!containerEl) return;
  const reduced = prefersReducedMotion();

  if (reduced) {
    gsap.set(containerEl, { autoAlpha: 1, y: 0 });
    onComplete?.();
    return;
  }

  return gsap.fromTo(
    containerEl,
    { autoAlpha: 0, y: 6 },
    {
      autoAlpha: 1,
      y: 0,
      duration: MOTION_DUR.short,
      ease: MOTION_EASE.enter,
      clearProps: "transform",
      onComplete,
    },
  );
}

/**
 * Milestone audit trail entrance:
 * Staggers milestone rows in sequence with hairline alignment.
 */
export function animateMilestoneList(
  rows: NodeListOf<Element> | Element[],
  onComplete?: () => void,
) {
  const reduced = prefersReducedMotion();

  if (reduced) {
    gsap.set(rows, { autoAlpha: 1, x: 0 });
    onComplete?.();
    return;
  }

  return gsap.fromTo(
    rows,
    { autoAlpha: 0, x: -8 },
    {
      autoAlpha: 1,
      x: 0,
      duration: MOTION_DUR.short,
      stagger: 0.04,
      ease: MOTION_EASE.enter,
      clearProps: "transform",
      onComplete,
    },
  );
}

/**
 * Slide-in animation for dynamically added items (e.g. newly added milestone card).
 */
export function animateItemSlideIn(
  element: Element | null,
  onComplete?: () => void,
) {
  if (!element) return;
  if (prefersReducedMotion()) {
    gsap.set(element, { autoAlpha: 1, y: 0 });
    onComplete?.();
    return;
  }

  return gsap.fromTo(
    element,
    { autoAlpha: 0, y: -8 },
    {
      autoAlpha: 1,
      y: 0,
      duration: MOTION_DUR.short,
      ease: MOTION_EASE.crisp,
      clearProps: "transform",
      onComplete,
    },
  );
}

/**
 * View transition when switching between application modes (e.g. Marketplace <-> Details <-> Create).
 */
export function animateViewTransition(
  containerEl: Element | null,
  onComplete?: () => void,
) {
  if (!containerEl) return;
  if (prefersReducedMotion()) {
    gsap.set(containerEl, { autoAlpha: 1, y: 0 });
    onComplete?.();
    return;
  }

  return gsap.fromTo(
    containerEl,
    { autoAlpha: 0, y: 8 },
    {
      autoAlpha: 1,
      y: 0,
      duration: MOTION_DUR.short,
      ease: MOTION_EASE.enter,
      clearProps: "transform",
      onComplete,
    },
  );
}
