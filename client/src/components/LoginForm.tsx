import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSuccess?: () => void;
}

export function LoginForm({ onSwitchToRegister, onSuccess }: LoginFormProps) {
  const { login, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    clearError();

    if (!email.trim() || !password) {
      setFormError('Please enter both email and password');
      return;
    }

    try {
      await login(email, password);
      onSuccess?.();
    } catch {
      // Error is caught by AuthContext
    }
  };

  return (
    <div className="content-panel" style={{ maxWidth: '440px', marginInline: 'auto' }}>
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <h2 style={{ margin: 0, color: 'var(--color-ink)', fontSize: 'var(--text-lg)', fontWeight: 500 }}>
          Welcome back
        </h2>
        <p style={{ color: 'var(--color-muted)', fontSize: 'var(--text-xs)', marginTop: 'var(--space-3xs)' }}>
          Sign in to your GitEscrow developer account
        </p>
      </div>

      {(error || formError) && (
        <div className="alert-box alert-error" role="alert">
          <span>{formError || error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="field-label" htmlFor="email">Email address</label>
          <input
            id="email"
            className="input-field"
            type="email"
            placeholder="developer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="field-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input-field"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-xs)' }} disabled={loading}>
          {loading ? 'Authenticating…' : 'Sign in'}
        </button>
      </form>

      <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-sm)', borderTop: 'var(--rule-hair) solid var(--color-rule)', textAlign: 'center', fontSize: 'var(--text-xs)' }}>
        <span style={{ color: 'var(--color-muted)' }}>Don’t have an account? </span>
        <button type="button" onClick={onSwitchToRegister} className="btn-link">
          Create one now
        </button>
      </div>
    </div>
  );
}
