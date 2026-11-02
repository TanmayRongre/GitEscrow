import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
  onSuccess?: () => void;
}

export function RegisterForm({ onSwitchToLogin, onSuccess }: RegisterFormProps) {
  const { register, loading, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long');
      return;
    }

    try {
      await register(name, username, email, password);
      onSuccess?.();
    } catch {
      // Caught in context
    }
  };

  return (
    <div className="content-panel" style={{ maxWidth: '440px', marginInline: 'auto' }}>
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <h2 style={{ margin: 0, color: 'var(--color-ink)', fontSize: 'var(--text-lg)', fontWeight: 500 }}>
          Create GitEscrow account
        </h2>
        <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-3xs)' }}>
          Open-source milestone escrow for developers
        </p>
      </div>

      {(error || formError) && (
        <div className="alert-box alert-error" role="alert">
          <span>{formError || error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="field-label" htmlFor="reg-name">Full name</label>
          <input
            id="reg-name"
            className="input-field"
            type="text"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
            autoComplete="name"
          />
        </div>

        <div className="form-group">
          <label className="field-label" htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            className="input-field"
            type="text"
            placeholder="adalovelace"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            required
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label className="field-label" htmlFor="reg-email">Email address</label>
          <input
            id="reg-email"
            className="input-field"
            type="email"
            placeholder="ada@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="field-label" htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            className="input-field"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label className="field-label" htmlFor="reg-confirm">Confirm password</label>
          <input
            id="reg-confirm"
            className="input-field"
            type="password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            required
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-xs)' }} disabled={loading}>
          {loading ? 'Creating account…' : 'Complete registration'}
        </button>
      </form>

      <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: 'var(--rule-hair) solid var(--color-rule)', textAlign: 'center', fontSize: 'var(--text-xs)' }}>
        <span style={{ color: 'var(--color-muted)' }}>Already have an account? </span>
        <button type="button" onClick={onSwitchToLogin} className="btn-link">
          Sign in
        </button>
      </div>
    </div>
  );
}
