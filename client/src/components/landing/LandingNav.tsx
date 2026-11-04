import { useState, useEffect } from "react";

interface LandingNavProps {
  onExploreBounties: () => void;
  onSignIn: () => void;
  onRegister: () => void;
  onViewProfile?: () => void;
  isAuthenticated: boolean;
  currentUser?: { username: string; role?: string } | null;
  loading?: boolean;
  onSignOut?: () => void;
}

export function LandingNav({
  onExploreBounties,
  onSignIn,
  onRegister,
  onViewProfile,
  isAuthenticated,
  currentUser,
  loading = false,
  onSignOut,
}: LandingNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 16);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleScrollToTop = () => {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header className={`landing-nav ${scrolled ? "landing-nav-scrolled" : ""}`}>
      <div className="landing-nav-container">
        {/* Left: Logo */}
        <div className="landing-nav-brand">
          <button
            type="button"
            className="logo-area"
            onClick={handleScrollToTop}
            aria-label="GitEscrow home"
          >
            <span className="logo-mark">GE</span>
            <span className="logo-title">GitEscrow</span>
          </button>
        </div>

        {/* Center: Desktop Navigation */}
        <nav className="landing-nav-links" aria-label="Landing page sections">
          <button
            type="button"
            className="landing-nav-link"
            onClick={handleScrollToTop}
          >
            Home
          </button>
          <button
            type="button"
            className="landing-nav-link"
            onClick={onExploreBounties}
          >
            Explore Bounties
          </button>
          <button
            type="button"
            className="landing-nav-link"
            onClick={() => scrollToSection("how-it-works")}
          >
            How It Works
          </button>
          <button
            type="button"
            className="landing-nav-link"
            onClick={() => scrollToSection("for-sponsors")}
          >
            For Sponsors
          </button>
          <button
            type="button"
            className="landing-nav-link"
            onClick={() => scrollToSection("for-developers")}
          >
            For Developers
          </button>
        </nav>

        {/* Right: Actions */}
        <div className="landing-nav-actions">
          {loading ? (
            <span className="user-label">Connecting…</span>
          ) : isAuthenticated && currentUser ? (
            <div className="user-signed-in">
              <button
                type="button"
                className="nav-user-control"
                onClick={onViewProfile || onExploreBounties}
                title="View account profile"
              >
                <span className="user-username">@{currentUser.username}</span>
                <span
                  className={`status-badge ${currentUser.role === "ADMIN" ? "badge-admin" : "badge-user"}`}
                >
                  {currentUser.role === "ADMIN" ? "admin" : "member"}
                </span>
              </button>
              {onSignOut ? (
                <button
                  type="button"
                  className="btn btn-sm btn-logout"
                  onClick={onSignOut}
                  title="Sign out of GitEscrow"
                >
                  Logout
                </button>
              ) : null}
            </div>
          ) : (
            <div className="landing-auth-buttons">
              <button type="button" className="btn btn-sm" onClick={onSignIn}>
                Login
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={onRegister}
              >
                Get Started
              </button>
            </div>
          )}

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle mobile menu"
          >
            <span className={`hamburger-bar ${mobileMenuOpen ? "open" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen ? (
        <div
          className="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          <div className="mobile-nav-links">
            <button
              type="button"
              className="mobile-nav-link"
              onClick={handleScrollToTop}
            >
              Home
            </button>
            <button
              type="button"
              className="mobile-nav-link"
              onClick={() => {
                setMobileMenuOpen(false);
                onExploreBounties();
              }}
            >
              Explore Bounties
            </button>
            <button
              type="button"
              className="mobile-nav-link"
              onClick={() => scrollToSection("how-it-works")}
            >
              How It Works
            </button>
            <button
              type="button"
              className="mobile-nav-link"
              onClick={() => scrollToSection("for-sponsors")}
            >
              For Sponsors
            </button>
            <button
              type="button"
              className="mobile-nav-link"
              onClick={() => scrollToSection("for-developers")}
            >
              For Developers
            </button>

            <div className="mobile-nav-divider" />

            {loading ? (
              <span className="user-label">Connecting…</span>
            ) : isAuthenticated && currentUser ? (
              <div className="mobile-auth-column">
                <div className="mobile-user-row">
                  <span className="user-username">
                    @{currentUser.username}
                  </span>
                  <span
                    className={`status-badge ${currentUser.role === "ADMIN" ? "badge-admin" : "badge-user"}`}
                  >
                    {currentUser.role === "ADMIN" ? "admin" : "member"}
                  </span>
                </div>
                {onViewProfile ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onViewProfile();
                    }}
                  >
                    Account Profile
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onExploreBounties();
                  }}
                >
                  Explore Bounties
                </button>
                {onSignOut ? (
                  <button
                    type="button"
                    className="btn btn-logout"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    Logout
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mobile-auth-column">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignIn();
                  }}
                >
                  Login
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onRegister();
                  }}
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
