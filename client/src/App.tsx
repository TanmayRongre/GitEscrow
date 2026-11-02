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
import { animateViewTransition } from './motion/transitions';

type ViewMode = 'marketplace' | 'details' | 'create' | 'profile' | 'auth';

function AppContent() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('marketplace');
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const mainContentRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (mainContentRef.current && !loading) {
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

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="header-container">
          <div className="header-brand-row">
            <button
              type="button"
              className="logo-area"
              onClick={() => {
                setSelectedBountyId(null);
                setViewMode('marketplace');
              }}
            >
              <span className="logo-mark">GE</span>
              <span className="logo-title">GitEscrow</span>
            </button>

            <div className="user-nav-status">
              {loading ? (
                <span className="user-label">Connecting…</span>
              ) : isAuthenticated && user ? (
                <div className="user-signed-in">
                  <span className="user-label">
                    Signed in as <strong className="user-username">@{user.username}</strong>
                  </span>
                  <span className={`status-badge ${user.role === 'ADMIN' ? 'badge-admin' : 'badge-user'}`}>
                    {user.role === 'ADMIN' ? 'admin' : 'member'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={logout}
                    title="Sign out of GitEscrow"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="auth-nav-buttons">
                  <button
                    type="button"
                    className={`btn btn-sm ${authMode === 'login' && viewMode === 'auth' ? 'btn-primary' : ''}`}
                    onClick={() => {
                      setAuthMode('login');
                      setViewMode('auth');
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${authMode === 'register' && viewMode === 'auth' ? 'btn-primary' : ''}`}
                    onClick={() => {
                      setAuthMode('register');
                      setViewMode('auth');
                    }}
                  >
                    Create account
                  </button>
                </div>
              )}
            </div>
          </div>

          <nav className="header-nav" aria-label="Main navigation">
            <button
              type="button"
              className={`nav-link ${viewMode === 'marketplace' || viewMode === 'details' ? 'nav-active' : ''}`}
              onClick={() => {
                setSelectedBountyId(null);
                setViewMode('marketplace');
              }}
            >
              Marketplace
            </button>

            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  className={`nav-link ${viewMode === 'create' ? 'nav-active' : ''}`}
                  onClick={() => setViewMode('create')}
                >
                  Create bounty
                </button>
                <button
                  type="button"
                  className={`nav-link ${viewMode === 'profile' ? 'nav-active' : ''}`}
                  onClick={() => setViewMode('profile')}
                >
                  Profile
                </button>
              </>
            ) : null}
          </nav>
        </div>
      </header>

      <main ref={mainContentRef} className="main-content">
        {loading ? (
          <div className="loading-state">
            <p>Loading application session…</p>
          </div>
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
              setViewMode('marketplace');
            }}
          />
        ) : viewMode === 'create' ? (
          <ProtectedRoute>
            <CreateBountyForm
              onBountyCreated={handleBountyCreated}
              onCancel={() => setViewMode('marketplace')}
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
                onSuccess={() => setViewMode('marketplace')}
              />
            ) : (
              <RegisterForm
                onSwitchToLogin={() => setAuthMode('login')}
                onSuccess={() => setViewMode('marketplace')}
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
