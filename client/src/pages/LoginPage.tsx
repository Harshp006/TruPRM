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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.mustChangePassword) {
        navigate('/change-password');
      } else if (loggedInUser.role === 'HR_PAYROLL_USER') {
        navigate('/payruns');
      } else if (loggedInUser.role === 'HR_MANAGER') {
        navigate('/employees');
      } else if (loggedInUser.role === 'EMPLOYEE') {
        navigate('/payslips');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[#F0F4F8]">
      {/* Left Pane - Branding/Illustration (Typical Enterprise HR App style) */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-50 items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-100 to-brand-50 opacity-50"></div>
        <div className="relative z-10 max-w-lg p-12">
          <h1 className="text-4xl font-bold text-brand-700 mb-6">
            Welcome to TruPRM
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            The next-generation enterprise HR & Payroll Management System. Simplify your daily operations with our comprehensive suite of tools.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center mb-3">
                <span className="text-brand-600 text-xl">✓</span>
              </div>
              <h3 className="font-semibold text-slate-800">Payroll</h3>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="w-10 h-10 bg-pastel-green rounded-lg flex items-center justify-center mb-3">
                <span className="text-emerald-600 text-xl">👥</span>
              </div>
              <h3 className="font-semibold text-slate-800">HR Core</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white shadow-xl lg:shadow-none z-10 rounded-3xl lg:rounded-none lg:h-screen my-auto mx-4 lg:mx-0 min-h-[500px]">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="text-center mb-10 lg:hidden">
            <h1 className="text-3xl font-bold text-brand-600 tracking-tight">
              TruPRM
            </h1>
          </div>
          
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Please enter your details to access your dashboard
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white
                           transition duration-200"
                placeholder="admin@truprm.com"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white
                           transition duration-200"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center">
                <input id="remember" type="checkbox" className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300" />
                <label htmlFor="remember" className="ml-2 text-sm text-slate-600">Remember me</label>
              </div>
              <a href="#" className="text-sm font-medium text-brand-600 hover:text-brand-500">Forgot password?</a>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-white mt-4
                         bg-brand-600 hover:bg-brand-500 active:bg-brand-700
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition duration-200 shadow-sm shadow-brand-500/30
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          
          <p className="text-center text-slate-500 text-xs mt-8">
            TruPRM © {new Date().getFullYear()} - Enterprise HR System
          </p>
        </div>
      </div>
    </div>
  );
}
