import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [location]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('No reset token provided. Please request a new link.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* Left side - Hero Image Area */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-white items-center justify-center">
        <img
          src="/images/hero-bg.png"
          alt="TruPRM Background"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Right side - Reset Form */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-8 bg-white shadow-[0_0_40px_rgba(0,0,0,0.05)] z-10">
        <div className="max-w-md w-full space-y-8">
          
          <div className="text-center">
            <img src="/images/logo.png" alt="TruPRM Logo" className="h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Reset Password
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Enter a new secure password for your account.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-lg text-sm border border-rose-200 text-center">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm border border-green-200 text-center">
                Password reset successfully! Redirecting to login...
              </div>
            )}

            {!success && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Token</label>
                  <input
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 block w-full px-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {!success && (
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Reset Password'}
              </button>
            )}

            <div className="text-center mt-4">
              <Link to="/login" className="text-sm text-brand-primary font-medium hover:text-brand-secondary transition-colors">
                Back to Login
              </Link>
            </div>
          </form>

          <div className="mt-10 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} TruPRM Government Systems. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
