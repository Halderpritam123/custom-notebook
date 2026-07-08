import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useLoginMutation, useRegisterMutation, useForgotPasswordMutation, useResetPasswordMutation } from '../services/api.js';
import { setCredentials } from '../store/authSlice.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [resetToken, setResetToken] = useState('');

  const dispatch = useDispatch();
  const [login, { isLoading: isLoggingIn }] = useLoginMutation();
  const [register, { isLoading: isRegistering }] = useRegisterMutation();
  const [forgotPassword, { isLoading: isSendingReset }] = useForgotPasswordMutation();
  const [resetPassword, { isLoading: isResettingPassword }] = useResetPasswordMutation();
  const isLoading = isLoggingIn || isRegistering || isSendingReset || isResettingPassword;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('reset');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setMode('reset');
    }

    fetch(`${API_BASE}/auth/status`)
      .then((r) => r.json())
      .then((data) => {
        setRegistrationOpen(data.registration_open);
        if (!data.registration_open) setMode('login');
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setStatusMessage('');

    try {
      if (mode === 'forgot') {
        const result = await forgotPassword({ email: email.trim() }).unwrap();
        setStatusMessage(result.message);
        return;
      }

      if (mode === 'reset') {
        if (!resetToken) {
          setError('Reset token is missing.');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        const result = await resetPassword({ token: resetToken, new_password: password }).unwrap();
        setStatusMessage(result.message);
        setPassword('');
        setConfirmPassword('');
        setMode('login');
        return;
      }

      const fn = mode === 'login' ? login : register;
      const result = await fn({ email: email.trim(), password }).unwrap();
      dispatch(setCredentials({ token: result.token, email: result.email }));
    } catch (err) {
      setError(err?.data?.detail || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Notebook
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {mode === 'login' ? 'Sign in to your account' : mode === 'register' ? 'Create a new account' : mode === 'forgot' ? 'Reset your password' : 'Choose a new password'}
        </p>

        {/* Registration closed banner */}
        {!registrationOpen && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
              Registrations are temporarily closed.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Existing users can still sign in below.
            </p>
          </div>
        )}

        {/* OAuth buttons — only when registration is open */}
        {registrationOpen && (
          <>
            <div className="space-y-2 mb-4">
              <a href={`${API_BASE}/auth/google`}
                className="flex items-center justify-center gap-3 w-full px-4 py-2 text-sm font-medium
                           border border-gray-300 dark:border-gray-700 rounded-lg
                           text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
                           hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </a>
              <a href={`${API_BASE}/auth/github`}
                className="flex items-center justify-center gap-3 w-full px-4 py-2 text-sm font-medium
                           border border-gray-300 dark:border-gray-700 rounded-lg
                           text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
                           hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
              </a>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>
          </>
        )}

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required disabled={isLoading} placeholder="you@example.com"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                           rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400
                           disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required disabled={isLoading} placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                           rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400
                           disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            </div>
          )}

          {mode === 'reset' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                required disabled={isLoading} placeholder="••••••••"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                           rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400
                           disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
          {statusMessage && <p className="text-xs text-green-600 dark:text-green-400">{statusMessage}</p>}

          <button type="submit" disabled={isLoading}
            className="w-full py-2 text-sm font-medium text-white bg-brand-500
                       rounded-lg hover:bg-brand-600 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-brand-400">
            {isLoading
              ? (mode === 'login' ? 'Signing in…' : mode === 'register' ? 'Creating account…' : mode === 'forgot' ? 'Sending link…' : 'Updating password…')
              : (mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password')}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400 space-y-2">
          {mode === 'login' && (
            <button type="button"
              onClick={() => { setMode('forgot'); setError(null); setStatusMessage(''); }}
              className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
              Forgot password?
            </button>
          )}

          {(mode === 'forgot' || mode === 'reset') && (
            <button type="button"
              onClick={() => { setMode('login'); setError(null); setStatusMessage(''); setPassword(''); setConfirmPassword(''); }}
              className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
              Back to sign in
            </button>
          )}
        </div>

        {/* Register link — hidden when registration is closed */}
        {registrationOpen && mode !== 'forgot' && mode !== 'reset' && (
          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setStatusMessage(''); }}
              className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        )}

        {/* Support/Contact section */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
            Need help? Contact us:
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=pritam.halder.dev@gmail.com&su=Support%20Request%20-%20Notebook"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs
                         text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800
                         rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </a>
            <a href="https://www.linkedin.com/in/pritam-halder-dev/"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs
                         text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800
                         rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/>
              </svg>
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
