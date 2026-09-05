import { useState, useEffect } from 'react';
import { fetchAttendanceStatus, toggleAttendance } from '../api/hr';

export default function AttendanceToggleWidget({ compact = false }: { compact?: boolean }) {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const checkStatus = async () => {
    try {
      const data = await fetchAttendanceStatus();
      setIsCheckedIn(data.isCheckedIn);
    } catch (err) {
      console.error('Failed to load attendance status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await toggleAttendance();
      setIsCheckedIn(res.isCheckedIn);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to toggle check-in/out');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-slate-400">Loading attendance...</div>;
  }

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-sm ${
          isCheckedIn
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
            : 'bg-slate-700 hover:bg-slate-800 text-white'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${isCheckedIn ? 'bg-white animate-pulse' : 'bg-slate-400'}`}></span>
        {toggling ? 'Updating...' : isCheckedIn ? 'Checked In (Click to Check Out)' : 'Check In'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
      <div className="flex-1">
        <div className="text-xs font-medium text-slate-500">Attendance Status</div>
        <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isCheckedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
          {isCheckedIn ? 'Currently Checked In' : 'Checked Out'}
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-sm ${
          isCheckedIn
            ? 'bg-rose-600 hover:bg-rose-700'
            : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {toggling ? 'Updating...' : isCheckedIn ? 'Check Out' : 'Check In'}
      </button>
    </div>
  );
}
