import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, prefersReducedMotion } from "../motion/gsapSetup";
import { MOTION_DUR, MOTION_EASE, MOTION_DIST } from "../motion/motionTokens";
import { LandingNav } from "./landing/LandingNav";
import { HeroSection } from "./landing/HeroSection";
import { ProblemSection } from "./landing/ProblemSection";
import { ProductShowcaseSection } from "./landing/ProductShowcaseSection";
import { HowItWorksSection } from "./landing/HowItWorksSection";
import { FeaturesSection } from "./landing/FeaturesSection";
import { AIVerificationSection } from "./landing/AIVerificationSection";
import { AudienceSection } from "./landing/AudienceSection";
import { FinalCTASection } from "./landing/FinalCTASection";
import { LandingFooter } from "./landing/LandingFooter";

interface LandingPageProps {
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

export function LandingPage({
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
  const landingRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;

      // Subtle hero entrance cascade: transforms and opacity only
      gsap.from(".hero-enter", {
        y: MOTION_DIST.entranceY,
        opacity: 0,
        duration: MOTION_DUR.med,
        stagger: MOTION_DUR.stagger * 2,
        ease: MOTION_EASE.enter,
        clearProps: "transform,opacity",
      });

      gsap.from(".hero-preview-enter", {
        y: MOTION_DIST.entranceY * 1.5,
        opacity: 0,
        duration: MOTION_DUR.long,
        delay: 0.1,
        ease: MOTION_EASE.enter,
        clearProps: "transform,opacity",
      });
    },
    { scope: landingRef },
  );

  return (
    <div ref={landingRef} className="landing-page-root">
      {/* Navigation */}
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

      {/* Main Sections — Alternating Black & Warm Cream Rhythm */}
      <main className="landing-main-content">
        {/* 1. Hero — Black */}
        <HeroSection
          onExploreBounties={onExploreBounties}
          onLaunchBounty={onLaunchBounty}
        />

        {/* 2. Problem / Value Proposition — Warm Cream */}
        <ProblemSection />

        {/* 3. Product Showcase — Dark */}
        <ProductShowcaseSection onExploreBounties={onExploreBounties} />

        {/* 4. How It Works — Warm Cream */}
        <HowItWorksSection />

        {/* 5. Features / Capabilities — Warm Cream Alternating Spreads */}
        <FeaturesSection />

        {/* 6. AI Verification Showcase — Dark */}
        <AIVerificationSection />

        {/* 7. Developer & Sponsor Sections — Warm Cream */}
        <AudienceSection
          onExploreBounties={onExploreBounties}
          onLaunchBounty={onLaunchBounty}
        />

        {/* 8. Final CTA — Black */}
        <FinalCTASection
          onExploreBounties={onExploreBounties}
          onRegister={onRegister}
        />
      </main>

      {/* Footer */}
      <LandingFooter
        onExploreBounties={onExploreBounties}
        onLaunchBounty={onLaunchBounty}
      />
    </div>
  );
}
