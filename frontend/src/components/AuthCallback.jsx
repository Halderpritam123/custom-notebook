import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/authSlice.js';

/**
 * Handles the OAuth redirect callback.
 * URL format: /auth/callback?token=JWT&email=user@example.com
 */
export default function AuthCallback() {
  const dispatch = useDispatch();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    const error = params.get('error');

    if (token && email) {
      dispatch(setCredentials({ token, email }));
      // Clean up URL and navigate to app root
      window.history.replaceState({}, '', '/');
    } else {
      // OAuth failed — go back to login
      console.error('OAuth callback error:', error);
      window.history.replaceState({}, '', '/');
    }
  }, [dispatch]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <p className="text-sm text-gray-500 dark:text-gray-400">Signing you in…</p>
    </div>
  );
}
