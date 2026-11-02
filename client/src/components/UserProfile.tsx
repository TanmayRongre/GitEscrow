import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { CheckIcon, AlertIcon } from './Icons';

interface Organization {
  _id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'SPONSOR' | 'MEMBER';
  joinedAt: string;
}

export function UserProfile() {
  const { user, logout } = useAuth();
  const [adminTestResult, setAdminTestResult] = useState<{ status: 'idle' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  });
  const [adminTestLoading, setAdminTestLoading] = useState(false);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // New org form
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createOrgMessage, setCreateOrgMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      setOrgError(null);
      const res = await apiRequest<{ organizations: Organization[] }>('/organizations');
      setOrganizations(res.organizations || []);
    } catch (err: any) {
      setOrgError(err.message || 'Failed to load organizations');
    } finally {
      setLoadingOrgs(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrganizations();
    }
  }, [user]);

  const handleTestAdmin = async () => {
    setAdminTestLoading(true);
    setAdminTestResult({ status: 'idle', message: '' });
    try {
      const res = await apiRequest<{ message: string; user: any }>('/admin/test');
      setAdminTestResult({
        status: 'success',
        message: `HTTP 200: ${res.message}`
      });
    } catch (err: any) {
      setAdminTestResult({
        status: 'error',
        message: `HTTP ${err.status || 403}: ${err.message || 'Access Denied: Global role ADMIN required.'}`
      });
    } finally {
      setAdminTestLoading(false);
    }
  };

  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;

    setCreatingOrg(true);
    setCreateOrgMessage(null);
    try {
      await apiRequest('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: newOrgName, slug: newOrgSlug })
      });
      setCreateOrgMessage({ type: 'success', text: `Organization “${newOrgName}” created successfully.` });
      setNewOrgName('');
      setNewOrgSlug('');
      await fetchOrganizations();
    } catch (err: any) {
      setCreateOrgMessage({ type: 'error', text: err.message || 'Failed to create organization' });
    } finally {
      setCreatingOrg(false);
    }
  };

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user.username.slice(0, 2).toUpperCase();

  return (
    <div style={{ maxWidth: '820px', marginInline: 'auto' }}>
      {/* Profile Header Panel */}
      <div className="content-panel" style={{ marginBottom: 'var(--space-md)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--color-paper-3)',
                border: 'var(--rule-hair) solid var(--color-rule-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 500,
                color: 'var(--color-accent)'
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 500 }}>{user.name}</h2>
                <span className={`status-badge ${user.role === 'ADMIN' ? 'badge-admin' : 'badge-user'}`}>
                  {user.role === 'ADMIN' ? 'admin' : 'member'}
                </span>
              </div>
              <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-3xs)' }}>
                @{user.username} <span style={{ marginInline: 'var(--space-2xs)' }}>•</span> {user.email}
              </div>
            </div>
          </div>
          <div>
            <button onClick={() => logout()} className="btn btn-sm">
              Sign out
            </button>
          </div>
        </div>

        {/* Security & Access Section */}
        <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-md)', borderTop: 'var(--rule-hair) solid var(--color-rule)' }}>
          <h3 style={{ margin: '0 0 var(--space-2xs)', fontSize: 'var(--text-md)', fontWeight: 500 }}>
            Security and access control
          </h3>
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)', margin: '0 0 var(--space-sm)' }}>
            Verify protected endpoints governed by JWT and role-based access control.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm)', backgroundColor: 'var(--color-paper-3)', borderRadius: 'var(--radius-pill)', border: 'var(--rule-hair) solid var(--color-rule)', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
            <div>
              <span className="measured" style={{ color: 'var(--color-ink)' }}>GET /api/admin/test</span>
              <div style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)' }}>
                Requires global administrator privilege
              </div>
            </div>
            <button
              onClick={handleTestAdmin}
              disabled={adminTestLoading}
              className="btn btn-sm btn-primary"
            >
              {adminTestLoading ? 'Verifying…' : 'Verify access'}
            </button>
          </div>

          {adminTestResult.status === 'success' && (
            <div className="alert-box alert-success" role="alert" style={{ marginTop: 'var(--space-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <CheckIcon />
                <span>{adminTestResult.message}</span>
              </div>
            </div>
          )}
          {adminTestResult.status === 'error' && (
            <div className="alert-box alert-error" role="alert" style={{ marginTop: 'var(--space-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <AlertIcon />
                <span>{adminTestResult.message}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Organizations Section */}
      <div className="content-panel">
        <h3 style={{ margin: '0 0 var(--space-2xs)', fontSize: 'var(--text-md)', fontWeight: 500 }}>
          Organization memberships
        </h3>
        <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)', margin: '0 0 var(--space-sm)' }}>
          Collaborative environments for funding and managing open-source bounties.
        </p>

        {loadingOrgs && <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)' }}>Loading organizations…</p>}
        {orgError && <div className="alert-box alert-error"><span>{orgError}</span></div>}

        {!loadingOrgs && organizations.length === 0 && (
          <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)', margin: 'var(--space-sm) 0' }}>
            You do not belong to any organizations yet. Create one below to get started.
          </p>
        )}

        {organizations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginBlock: 'var(--space-sm)' }}>
            {organizations.map((org: any) => {
              const role = (() => {
                if (org.role) return org.role;
                if (Array.isArray(org.members)) {
                  const member = org.members.find((m: any) => {
                    const mId = m.userId?._id?.toString() || m.userId?.toString();
                    const uId = user.id?.toString() || (user as any)._id?.toString();
                    return mId === uId;
                  });
                  if (member?.role) return member.role;
                }
                const ownerId = org.ownerId?._id?.toString() || org.ownerId?.toString();
                const uId = user.id?.toString() || (user as any)._id?.toString();
                if (ownerId && ownerId === uId) return 'OWNER';
                return 'MEMBER';
              })();

              return (
                <div
                  key={org._id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-xs) var(--space-sm)',
                    backgroundColor: 'var(--color-paper-3)',
                    border: 'var(--rule-hair) solid var(--color-rule)',
                    borderRadius: 'var(--radius-pill)'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{org.name}</span>
                    <span className="measured" style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)', marginLeft: 'var(--space-xs)' }}>/{org.slug}</span>
                  </div>
                  <div>
                    <span className={`status-badge ${role === 'OWNER' ? 'badge-admin' : 'badge-user'}`}>
                      {String(role).toLowerCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Organization Sub-form */}
        <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: 'var(--rule-hair) solid var(--color-rule)' }}>
          <h4 style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
            Create new organization
          </h4>
          {createOrgMessage && (
            <div
              className={`alert-box ${createOrgMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
              role="alert"
            >
              <span>{createOrgMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleCreateOrg} style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="input-field"
              style={{ flex: 1, minWidth: '160px' }}
              placeholder="Organization name"
              value={newOrgName}
              onChange={(e) => {
                setNewOrgName(e.target.value);
                if (!newOrgSlug) {
                  setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                }
              }}
              required
            />
            <input
              type="text"
              className="input-field"
              style={{ flex: 1, minWidth: '140px' }}
              placeholder="slug-identifier"
              value={newOrgSlug}
              onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ''))}
              required
            />
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={creatingOrg || !newOrgName.trim() || !newOrgSlug.trim()}
            >
              {creatingOrg ? 'Creating…' : 'Create'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
