import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    // Simulate signup request
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    }, 1000);
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

      {/* Right side - Signup Form */}
      <div className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-8 bg-white shadow-[0_0_40px_rgba(0,0,0,0.05)] z-10">
        <div className="max-w-md w-full space-y-8">
          
          <div className="text-center">
            <img src="/images/logo.png" alt="TruPRM Logo" className="h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">
              Create an Account
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Sign up to get started with TruPRM.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {success && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm border border-green-200">
                Account created successfully! Redirecting to login...
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-slate-300 rounded-lg placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors sm:text-sm"
                  placeholder="John Doe"
                />
              </div>
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
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
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
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || success}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-all disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Sign up'}
              </button>
            </div>
            
            <div className="text-center mt-4">
              <Link
                to="/login"
                className="text-sm font-medium text-brand-primary hover:text-brand-secondary transition-colors"
              >
                Already have an account? Sign in
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
