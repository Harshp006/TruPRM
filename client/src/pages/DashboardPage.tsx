import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navbar */}
      <header className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <span className="text-xl font-bold">
          Tru<span className="text-blue-400">PRM</span>
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            {user?.email} &mdash;{' '}
            <span className="text-blue-400 font-medium">{user?.role}</span>
          </span>
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="px-4 py-1.5 rounded-lg text-sm bg-white/10 hover:bg-white/20 border border-white/15 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="p-8">
        <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
        <p className="text-slate-400">
          Welcome, <span className="text-white font-medium">{user?.email}</span>! Your role is{' '}
          <span className="text-blue-400 font-medium">{user?.role}</span>.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-1">Role</h3>
            <p className="text-2xl font-bold text-blue-400">{user?.role}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-1">User ID</h3>
            <p className="text-xs font-mono text-slate-300 break-all">{user?.id}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-1">Status</h3>
            <p className="text-green-400 font-semibold">● Active session</p>
          </div>
        </div>
      </main>
    </div>
  );
}
