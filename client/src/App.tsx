import { useState, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UserProfile } from './components/UserProfile';
import { BountyList } from './components/BountyList';
import { BountyDetails } from './components/BountyDetails';
import { CreateBountyForm } from './components/CreateBountyForm';
import { LandingPage } from './components/LandingPage';
import { DashboardView } from './components/DashboardView';
import { Navbar } from './components/Navbar';
import { animateViewTransition } from './motion/transitions';

type ViewMode = 'landing' | 'dashboard' | 'marketplace' | 'details' | 'create' | 'profile' | 'auth';

function AppContent() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const mainContentRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (mainContentRef.current && !loading && viewMode !== 'landing') {
        animateViewTransition(mainContentRef.current);
      }
    },
    { dependencies: [viewMode, selectedBountyId], scope: mainContentRef }
  );

  const handleSelectBounty = (bountyId: string) => {
    setSelectedBountyId(bountyId);
    setViewMode('details');
  };

  const handleBountyCreated = (bountyId: string) => {
    setSelectedBountyId(bountyId);
    setViewMode('details');
  };

  const handleNavigateHome = () => {
    setSelectedBountyId(null);
    if (viewMode !== 'landing') {
      setViewMode('landing');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreBounties = () => {
    setSelectedBountyId(null);
    setViewMode('marketplace');
  };

  const handleNavigateSection = (sectionId: string) => {
    if (viewMode !== 'landing') {
      setSelectedBountyId(null);
      setViewMode('landing');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 60);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleSignIn = () => {
    setAuthMode('login');
    setViewMode('auth');
  };

  const handleRegister = () => {
    setAuthMode('register');
    setViewMode('auth');
  };

  const handleLaunchBounty = () => {
    if (isAuthenticated) {
      setViewMode('create');
    } else {
      setAuthMode('login');
      setViewMode('auth');
    }
  };

  const handleViewProfile = () => {
    setSelectedBountyId(null);
    setViewMode('dashboard');
  };

  return (
    <div className="app-root">
      <Navbar
        currentRoute={viewMode}
        onNavigateHome={handleNavigateHome}
        onExploreBounties={handleExploreBounties}
        onNavigateSection={handleNavigateSection}
        onSignIn={handleSignIn}
        onRegister={handleRegister}
        onViewProfile={handleViewProfile}
        isAuthenticated={isAuthenticated}
        currentUser={user}
        loading={loading}
        onSignOut={logout}
      />

      {viewMode === 'landing' ? (
        <LandingPage
          hideNav={true}
          onExploreBounties={handleExploreBounties}
          onLaunchBounty={handleLaunchBounty}
          onSignIn={handleSignIn}
          onRegister={handleRegister}
          onViewProfile={handleViewProfile}
          isAuthenticated={isAuthenticated}
          currentUser={user}
          loading={loading}
          onSignOut={logout}
        />
      ) : (
        <>
          <main ref={mainContentRef} className="main-content">
        {loading ? (
          <div className="loading-state">
            <p>Loading application session…</p>
          </div>
        ) : viewMode === 'dashboard' && user ? (
          <ProtectedRoute>
            <DashboardView
              currentUser={user}
              onSelectBounty={handleSelectBounty}
              onCreateBounty={() => setViewMode('create')}
              onExploreMarketplace={() => {
                setSelectedBountyId(null);
                setViewMode('marketplace');
              }}
              onOpenProfile={() => {
                setSelectedBountyId(null);
                setViewMode('profile');
              }}
            />
          </ProtectedRoute>
        ) : viewMode === 'marketplace' ? (
          <BountyList
            onSelectBounty={handleSelectBounty}
            onCreateNew={() => {
              if (isAuthenticated) {
                setViewMode('create');
              } else {
                setAuthMode('login');
                setViewMode('auth');
              }
            }}
            isAuthenticated={isAuthenticated}
          />
        ) : viewMode === 'details' && selectedBountyId ? (
          <BountyDetails
            bountyId={selectedBountyId}
            currentUser={user}
            onBack={() => {
              setSelectedBountyId(null);
              setViewMode(isAuthenticated ? 'dashboard' : 'marketplace');
            }}
          />
        ) : viewMode === 'create' ? (
          <ProtectedRoute>
            <CreateBountyForm
              onBountyCreated={handleBountyCreated}
              onCancel={() => setViewMode(isAuthenticated ? 'dashboard' : 'marketplace')}
            />
          </ProtectedRoute>
        ) : viewMode === 'profile' ? (
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        ) : (
          <div style={{ maxWidth: '640px', marginInline: 'auto' }}>
            <div style={{ marginBottom: 'var(--space-xl)', textAlign: 'center' }}>
              <h2 className="section-title" style={{ fontSize: 'var(--text-2xl)' }}>
                Open-source bounties backed by PayPal escrow
              </h2>
              <p className="section-subtitle" style={{ maxWidth: '54ch', marginInline: 'auto', marginTop: 'var(--space-xs)' }}>
                Sponsors fund bounties into PayPal escrow. Contributor pull requests are verified against issue criteria for automated milestone disbursements.
              </p>
            </div>

            {authMode === 'login' ? (
              <LoginForm
                onSwitchToRegister={() => setAuthMode('register')}
                onSuccess={() => setViewMode('dashboard')}
              />
            ) : (
              <RegisterForm
                onSwitchToLogin={() => setAuthMode('login')}
                onSuccess={() => setViewMode('dashboard')}
              />
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-title">GitEscrow</span>
            <span className="footer-desc">Precision, transparency and trust for open-source GitHub bounties</span>
          </div>
          <div className="footer-meta">
            <span className="measured">v1.0.0</span>
            <span>PayPal Sandbox Verified</span>
          </div>
        </div>
      </footer>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
