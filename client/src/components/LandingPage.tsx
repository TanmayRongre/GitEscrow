import { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "../motion/gsapSetup";
import { LandingNav } from "./landing/LandingNav";
import { HeroSection } from "./home/HeroSection";
import { ProblemSection } from "./home/ProblemSection";
import { HowItWorksSection } from "./home/HowItWorksSection";
import { EvidenceShowcaseSection } from "./home/EvidenceShowcaseSection";
import { AudiencesSection } from "./home/AudiencesSection";
import { FinalCtaFooterSection } from "./home/FinalCtaFooterSection";

interface LandingPageProps {
  hideNav?: boolean;
  onExploreBounties: () => void;
  onLaunchBounty: () => void;
  onSignIn: () => void;
  onRegister: () => void;
  onViewProfile?: () => void;
  isAuthenticated: boolean;
  currentUser?: { username: string; role?: string } | null;
  loading?: boolean;
  onSignOut?: () => void;
}

/**
 * GitEscrow Home Page
 * Rebuilt from scratch per Hallmark & Unslop specifications.
 * Sections:
 * 1. Hero (Dark - --ink)
 * 2. Problem (Cream - --cream)
 * 3. How It Works (Cream-Sunk - --cream-sunk)
 * 4. Evidence Before Approval (Dark - --ink)
 * 5. For Developers / For Sponsors (Cream - --cream)
 * 6. Final CTA + Footer (Dark - --ink)
 */
export function LandingPage({
  hideNav = false,
  onExploreBounties,
  onLaunchBounty,
  onSignIn,
  onRegister,
  onViewProfile,
  isAuthenticated,
  currentUser,
  loading = false,
  onSignOut,
}: LandingPageProps) {
  const mainRef = useRef<HTMLElement>(null);

  // Hero subtle entrance: runs immediately on mount, completes in < 500ms
  useGSAP(
    () => {
      if (prefersReducedMotion() || !mainRef.current) return;

      gsap.from(".hero-left-col > *", {
        autoAlpha: 0,
        y: 12,
        duration: 0.35,
        stagger: 0.07,
        ease: "power2.out",
        clearProps: "transform,opacity,visibility",
      });

      gsap.from(".hero-right-col", {
        autoAlpha: 0,
        y: 16,
        duration: 0.42,
        delay: 0.08,
        ease: "power2.out",
        clearProps: "transform,opacity,visibility",
      });
    },
    { scope: mainRef },
  );

  // Subsequent sections: lightweight scroll reveal using compositor transforms only
  useEffect(() => {
    if (prefersReducedMotion()) return;

    const sections = document.querySelectorAll<HTMLElement>(
      ".home-section-reveal",
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.fromTo(
              entry.target,
              { autoAlpha: 0, y: 16 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.38,
                ease: "power2.out",
                clearProps: "transform,opacity,visibility",
              },
            );
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );

    sections.forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="landing-page-root"
      style={{
        backgroundColor: "var(--ink)",
        color: "var(--text-dark-primary)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowX: "clip",
      }}
    >
      {/* Sticky Navigation: solid background, outside section hierarchy */}
      {!hideNav && (
        <LandingNav
          onExploreBounties={onExploreBounties}
          onSignIn={onSignIn}
          onRegister={onRegister}
          onViewProfile={onViewProfile}
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          loading={loading}
          onSignOut={onSignOut}
        />
      )}

      {/* Main Sections */}
      <main
        ref={mainRef}
        className="landing-main-content"
        style={{ flex: "1 0 auto" }}
      >
        {/* Section 1: Hero (Dark - --ink) */}
        <HeroSection
          onExploreBounties={onExploreBounties}
          onLaunchBounty={onLaunchBounty}
        />

        {/* Section 2: The Problem (Cream - --cream) */}
        <ProblemSection />

        {/* Section 3: How It Works (Cream-Sunk - --cream-sunk) */}
        <HowItWorksSection />

        {/* Section 4: Evidence Before Approval (Dark - --ink) */}
        <EvidenceShowcaseSection />

        {/* Section 5: For Developers / For Sponsors (Cream - --cream) */}
        <AudiencesSection
          onExploreBounties={onExploreBounties}
          onLaunchBounty={onLaunchBounty}
        />

        {/* Section 6: Final CTA + Footer (Dark - --ink) */}
        <FinalCtaFooterSection
          onExploreBounties={onExploreBounties}
          onLaunchBounty={onLaunchBounty}
        />
      </main>
    </div>
  );
}
