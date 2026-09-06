import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    
    if (isForgotPassword) {
      // Simulate password reset flow
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setResetSuccess(true);
      }, 1000);
      return;
    }

    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.mustChangePassword) {
        navigate('/change-password');
      } else {
        if (loggedInUser.role === 'EMPLOYEE') {
          navigate('/payslips');
        } else if (loggedInUser.role === 'HR_PAYROLL_USER') {
          navigate('/payroll-home');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* Left side - Hero Image Area */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-white items-center justify-center p-8">
        <img 
          src="/images/hero-bg.png" 
          alt="TruPRM Background" 
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Right side - Login Form */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-8 bg-white shadow-[0_0_40px_rgba(0,0,0,0.05)] z-10">
        <div className="max-w-md w-full space-y-8">
          
          {/* Logo Header */}
          <div className="text-center">
            <img src="/images/logo.png" alt="TruPRM Logo" className="h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">
              {isForgotPassword ? 'Reset Password' : 'Welcome Back'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {isForgotPassword 
                ? "Enter your email to receive a password reset link." 
                : "Please sign in to access your dashboard."}
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}
            
            {resetSuccess && isForgotPassword && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm border border-green-200">
                If an account exists, a reset link has been sent to your email.
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-slate-300 rounded-lg placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors sm:text-sm"
                  placeholder="name@company.com"
                />
              </div>

              {!isForgotPassword && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-sm font-medium text-brand-primary hover:text-brand-secondary transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none relative block w-full px-4 py-3 border border-slate-300 rounded-lg placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-all disabled:opacity-50"
              >
                {loading 
                  ? 'Processing...' 
                  : (isForgotPassword ? 'Send Reset Link' : 'Sign in')}
              </button>
            </div>
            
            {isForgotPassword && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetSuccess(false);
                  }}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                >
                  &larr; Back to login
                </button>
              </div>
            )}
          </form>
          
          {/* Footer branding */}
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
