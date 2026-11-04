import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../api/client";
import { CheckIcon, AlertIcon, InfoIcon } from "./Icons";

interface Organization {
  _id: string;
  name: string;
  slug: string;
  role: "OWNER" | "SPONSOR" | "MEMBER";
  joinedAt: string;
}

interface PayoutProfile {
  configured: boolean;
  paypalEmail: string | null;
  maskedEmail: string | null;
}

export function UserProfile() {
  const { user, logout } = useAuth();
  const [adminTestResult, setAdminTestResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
  }>({
    status: "idle",
    message: "",
  });
  const [adminTestLoading, setAdminTestLoading] = useState(false);

  // Organizations state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // New org form
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createOrgMessage, setCreateOrgMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Task 2D: Payout Profile State
  const [payoutProfile, setPayoutProfile] = useState<PayoutProfile | null>(null);
  const [editingPayout, setEditingPayout] = useState(false);
  const [payoutEmailInput, setPayoutEmailInput] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      setOrgError(null);
      const res = await apiRequest<{ organizations: Organization[] }>("/organizations");
      setOrganizations(res.organizations || []);
    } catch (err: any) {
      setOrgError(err.message || "Failed to load organizations");
    } finally {
      setLoadingOrgs(false);
    }
  };

  const fetchPayoutProfile = async () => {
    try {
      const res = await apiRequest<{ payoutProfile: PayoutProfile }>("/users/me/payout-profile");
      if (res?.payoutProfile) {
        setPayoutProfile(res.payoutProfile);
        setPayoutEmailInput(res.payoutProfile.paypalEmail || "");
      }
    } catch {
      // Non-fatal if offline
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrganizations();
      fetchPayoutProfile();
    }
  }, [user]);

  const handleUpdatePayoutProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!payoutEmailInput.trim()) return;

    try {
      setSavingPayout(true);
      setPayoutMessage(null);
      const res = await apiRequest<{
        success: boolean;
        message: string;
        payoutProfile: PayoutProfile;
      }>("/users/me/payout-profile", {
        method: "PATCH",
        body: JSON.stringify({ paypalEmail: payoutEmailInput.trim() }),
      });

      setPayoutProfile(res.payoutProfile);
      setPayoutMessage({
        type: "success",
        text: "PayPal payout recipient email saved successfully.",
      });
      setEditingPayout(false);
    } catch (err: any) {
      setPayoutMessage({
        type: "error",
        text: err.message || "Failed to update payout profile",
      });
    } finally {
      setSavingPayout(false);
    }
  };

  const handleTestAdmin = async () => {
    setAdminTestLoading(true);
    setAdminTestResult({ status: "idle", message: "" });
    try {
      const res = await apiRequest<{ message: string; user: any }>("/admin/test");
      setAdminTestResult({
        status: "success",
        message: `HTTP 200: ${res.message}`,
      });
    } catch (err: any) {
      setAdminTestResult({
        status: "error",
        message: `HTTP ${err.status || 403}: ${
          err.message || "Access Denied: Global role ADMIN required."
        }`,
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
      await apiRequest("/organizations", {
        method: "POST",
        body: JSON.stringify({ name: newOrgName, slug: newOrgSlug }),
      });
      setCreateOrgMessage({
        type: "success",
        text: `Organization "${newOrgName}" created successfully.`,
      });
      setNewOrgName("");
      setNewOrgSlug("");
      await fetchOrganizations();
    } catch (err: any) {
      setCreateOrgMessage({
        type: "error",
        text: err.message || "Failed to create organization",
      });
    } finally {
      setCreatingOrg(false);
    }
  };

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user.username.slice(0, 2).toUpperCase();

  return (
    <div className="profile-container" style={{ maxWidth: "860px", marginInline: "auto" }}>
      {/* Profile Header Identity Card */}
      <div className="content-panel profile-identity-panel">
        <div className="profile-header-row">
          <div className="profile-avatar-group">
            <div className="profile-avatar-box font-mono">{initials}</div>
            <div className="profile-details">
              <div className="profile-name-row">
                <h2 className="profile-name">{user.name}</h2>
                <span
                  className={`status-badge ${
                    user.role === "ADMIN" ? "badge-admin" : "badge-user"
                  }`}
                >
                  {user.role === "ADMIN" ? "admin" : "member"}
                </span>
              </div>
              <div className="profile-meta font-mono text-xs text-muted">
                <span>@{user.username}</span>
                <span className="meta-separator">•</span>
                <span>{user.email}</span>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => logout()} className="btn btn-sm btn-secondary">
            Sign out
          </button>
        </div>
      </div>

      {/* Section 1: PayPal Milestone Payout Profile (Task 2D) */}
      <div className="content-panel" style={{ marginTop: "var(--space-md)" }}>
        <div className="panel-header-row">
          <div>
            <h3 className="panel-title">PayPal Payout Configuration</h3>
            <p className="panel-subtitle">
              Configure your verified recipient email for automated milestone disbursements.
            </p>
          </div>
          {payoutProfile?.configured && !editingPayout && (
            <span className="status-badge badge-completed">
              <CheckIcon width="10" height="10" />
              <span>Configured</span>
            </span>
          )}
          {!payoutProfile?.configured && (
            <span className="status-badge badge-draft">
              <AlertIcon width="10" height="10" />
              <span>Unconfigured</span>
            </span>
          )}
        </div>

        {payoutMessage && (
          <div
            className={`alert-box ${
              payoutMessage.type === "success" ? "alert-success" : "alert-error"
            }`}
            role="alert"
            style={{ marginBlock: "var(--space-sm)" }}
          >
            <span>{payoutMessage.text}</span>
          </div>
        )}

        {!editingPayout ? (
          <div className="payout-status-card">
            <div className="payout-info-row">
              <div className="payout-info-label">Active Recipient Email:</div>
              <div className="payout-info-value font-mono">
                {payoutProfile?.maskedEmail || (
                  <span className="text-muted">None configured (payouts disabled)</span>
                )}
              </div>
            </div>
            <div className="payout-actions-row">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setEditingPayout(true)}
              >
                {payoutProfile?.configured ? "Update Email" : "Configure Payout Email"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdatePayoutProfile} className="payout-edit-form">
            <div className="form-group" style={{ marginBottom: "var(--space-sm)" }}>
              <label className="field-label" htmlFor="paypal-email-input">
                PayPal Account Email
              </label>
              <input
                id="paypal-email-input"
                type="email"
                className="input-field"
                placeholder="contributor@paypal-sandbox.com"
                value={payoutEmailInput}
                onChange={(e) => setPayoutEmailInput(e.target.value)}
                required
                disabled={savingPayout}
              />
              <span className="field-hint text-xs text-muted">
                Must match an active, verified PayPal Sandbox or live account capable of receiving merchant payouts.
              </span>
            </div>
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={savingPayout || !payoutEmailInput.trim()}
              >
                {savingPayout ? "Saving…" : "Save Recipient"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={savingPayout}
                onClick={() => {
                  setEditingPayout(false);
                  setPayoutEmailInput(payoutProfile?.paypalEmail || "");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="security-notice font-mono text-xs text-muted">
          <InfoIcon width="12" height="12" />
          <span>
            Payout disbursements execute automatically upon sponsor milestone approval via PayPal Payouts API.
          </span>
        </div>
      </div>

      {/* Section 2: Organization Memberships */}
      <div className="content-panel" style={{ marginTop: "var(--space-md)" }}>
        <h3 className="panel-title">Organization Memberships</h3>
        <p className="panel-subtitle">
          Collaborative environments for funding and managing open-source bounties.
        </p>

        {loadingOrgs && (
          <p className="text-muted text-xs" style={{ marginBlock: "var(--space-xs)" }}>
            Loading organizations…
          </p>
        )}
        {orgError && (
          <div className="alert-box alert-error">
            <span>{orgError}</span>
          </div>
        )}

        {!loadingOrgs && organizations.length === 0 && (
          <p className="text-muted text-xs" style={{ margin: "var(--space-sm) 0" }}>
            You do not belong to any organizations yet. Create one below to get started.
          </p>
        )}

        {organizations.length > 0 && (
          <div className="orgs-list-stack">
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
                if (ownerId && ownerId === uId) return "OWNER";
                return "MEMBER";
              })();

              return (
                <div key={org._id || org.id} className="org-list-row">
                  <div className="org-name-col">
                    <span className="org-name-text">{org.name}</span>
                    <span className="org-slug-text font-mono text-xs text-muted">/{org.slug}</span>
                  </div>
                  <div>
                    <span
                      className={`status-badge ${
                        role === "OWNER" ? "badge-admin" : "badge-user"
                      }`}
                    >
                      {String(role).toLowerCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Organization Sub-form */}
        <div className="org-create-subform">
          <h4 className="subform-heading">Create new organization</h4>
          {createOrgMessage && (
            <div
              className={`alert-box ${
                createOrgMessage.type === "success" ? "alert-success" : "alert-error"
              }`}
              role="alert"
            >
              <span>{createOrgMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleCreateOrg} className="org-inputs-row">
            <input
              type="text"
              className="input-field"
              style={{ flex: 1, minWidth: "160px" }}
              placeholder="Organization name"
              value={newOrgName}
              onChange={(e) => {
                setNewOrgName(e.target.value);
                if (!newOrgSlug) {
                  setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                }
              }}
              required
            />
            <input
              type="text"
              className="input-field"
              style={{ flex: 1, minWidth: "140px" }}
              placeholder="slug-identifier"
              value={newOrgSlug}
              onChange={(e) =>
                setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""))
              }
              required
            />
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={creatingOrg || !newOrgName.trim() || !newOrgSlug.trim()}
            >
              {creatingOrg ? "Creating…" : "Create Org"}
            </button>
          </form>
        </div>
      </div>

      {/* Section 3: Security & Access Control */}
      <div className="content-panel" style={{ marginTop: "var(--space-md)" }}>
        <h3 className="panel-title">Security & Role-Based Access Control</h3>
        <p className="panel-subtitle">
          Verify protected API endpoints governed by JWT authentication and RBAC roles.
        </p>

        <div className="security-test-card">
          <div>
            <span className="font-mono text-xs text-ink" style={{ display: "block" }}>
              GET /api/admin/test
            </span>
            <span className="text-muted text-xs">
              Requires global administrator privilege (RBAC role: ADMIN)
            </span>
          </div>
          <button
            type="button"
            onClick={handleTestAdmin}
            disabled={adminTestLoading}
            className="btn btn-sm btn-primary"
          >
            {adminTestLoading ? "Verifying…" : "Verify Endpoint Access"}
          </button>
        </div>

        {adminTestResult.status === "success" && (
          <div className="alert-box alert-success" role="alert" style={{ marginTop: "var(--space-sm)" }}>
            <CheckIcon />
            <span>{adminTestResult.message}</span>
          </div>
        )}
        {adminTestResult.status === "error" && (
          <div className="alert-box alert-error" role="alert" style={{ marginTop: "var(--space-sm)" }}>
            <AlertIcon />
            <span>{adminTestResult.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
