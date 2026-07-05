import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useLoginMutation, useRegisterMutation } from '../services/api.js';
import { setCredentials } from '../store/authSlice.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  const dispatch = useDispatch();
  const [login, { isLoading: isLoggingIn }] = useLoginMutation();
  const [register, { isLoading: isRegistering }] = useRegisterMutation();
  const isLoading = isLoggingIn || isRegistering;

  useEffect(() => {
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
    try {
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
          {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
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
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required disabled={isLoading} placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400
                         disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required disabled={isLoading} placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                         rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400
                         disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button type="submit" disabled={isLoading}
            className="w-full py-2 text-sm font-medium text-white bg-blue-600
                       rounded-lg hover:bg-blue-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-blue-400">
            {isLoading
              ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
              : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        {/* Register link — hidden when registration is closed */}
        {registrationOpen && (
          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
