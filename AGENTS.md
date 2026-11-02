## Mandatory UI Skill
Before any frontend UI work, read and follow the
Hallmark skill located in `.agent`.

Hallmark is the primary UI design authority for this project.

## Mandatory UI Skills & Animation Rules

- Hallmark is the primary design authority across all pages, components, and layouts.
- All installed GSAP skills (`gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-utils`, `gsap-performance`, `gsap-plugins`, `gsap-frameworks`) located in `.agent/skills/` must be consulted when relevant.
- GSAP must strictly follow Hallmark's design restrictions:
  - Animate only transforms (`x`, `y`, `scale`, `rotation`, `xPercent`, `yPercent`) and opacity (`autoAlpha`).
  - Never animate layout properties that cause reflow (`width`, `height`, `top`, `left`, `margin`, `padding`).
  - Never use `transition: all`.
  - Avoid glowing effects, chromatic halos, gradients, and decorative clutter.
  - Do not animate monetary values in ways that could misrepresent financial balances or payment verification states.
- Tailwind CSS remains the styling implementation framework for layout, spacing, and responsive component structure, styled via Hallmark's centralized OKLCH design tokens (`tokens.css`).
- React components must use lifecycle-safe GSAP integration:
  - Prefer `useGSAP()` from `@gsap/react` with component-scoped refs (`scope: containerRef`).
  - Register GSAP plugins in a centralized client entry/setup module, never inside render loops.
  - Wrap event-driven / deferred animations in `contextSafe()`.
  - Ensure all timelines and ScrollTriggers are cleaned up upon component unmount.
- All animations must support reduced-motion preferences (`prefers-reduced-motion` via `gsap.matchMedia()` with zero duration or omitted motion).
- No frontend UI work should bypass Hallmark review.

## Mandatory UI Skills & Animation Rules

- Hallmark is the primary design authority across all pages, components, and layouts.
- All installed GSAP skills (`gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-utils`, `gsap-performance`, `gsap-plugins`, `gsap-frameworks`) located in `.agent/skills/` must be consulted when relevant.
- GSAP must strictly follow Hallmark's design restrictions:
  - Animate only transforms (`x`, `y`, `scale`, `rotation`, `xPercent`, `yPercent`) and opacity (`autoAlpha`).
  - Never animate layout properties that cause reflow (`width`, `height`, `top`, `left`, `margin`, `padding`).
  - Never use `transition: all`.
  - Avoid glowing effects, chromatic halos, gradients, and decorative clutter.
  - Do not animate monetary values in ways that could misrepresent financial balances or payment verification states.
- Tailwind CSS remains the styling implementation framework for layout, spacing, and responsive component structure, styled via Hallmark's centralized OKLCH design tokens (`tokens.css`).
- React components must use lifecycle-safe GSAP integration:
  - Prefer `useGSAP()` from `@gsap/react` with component-scoped refs (`scope: containerRef`).
  - Register GSAP plugins in a centralized client entry/setup module, never inside render loops.
  - Wrap event-driven / deferred animations in `contextSafe()`.
  - Ensure all timelines and ScrollTriggers are cleaned up upon component unmount.
- All animations must support reduced-motion preferences (`prefers-reduced-motion` via `gsap.matchMedia()` with zero duration or omitted motion).
- No frontend UI work should bypass Hallmark review.
