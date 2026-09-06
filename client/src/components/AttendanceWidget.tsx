import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAttendanceStatus,
  checkInAttendance,
  checkOutAttendance,
  type AttendanceStatusResponse,
} from '../api/hr';

interface AttendanceWidgetProps {
  compact?: boolean;
  onStatusChange?: () => void;
}

export const AttendanceWidget: React.FC<AttendanceWidgetProps> = ({
  compact = false,
  onStatusChange,
}) => {
  const { user } = useAuth();
  const [statusData, setStatusData] = useState<AttendanceStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [liveDurationStr, setLiveDurationStr] = useState('00:00:00');

  const loadStatus = useCallback(async () => {
    try {
      setErrorMsg('');
      const data = await fetchAttendanceStatus();
      setStatusData(data);
    } catch (err: any) {
      console.error('Failed to load attendance status', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Live timer for active check-in session
  useEffect(() => {
    if (!statusData?.isCheckedIn || !statusData?.activeAttendance?.checkIn) {
      setLiveDurationStr('00:00:00');
      return;
    }

    const checkInTime = new Date(statusData.activeAttendance.checkIn).getTime();

    const updateTimer = () => {
      const diffMs = Math.max(0, Date.now() - checkInTime);
      const totalSec = Math.floor(diffMs / 1000);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;

      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      setLiveDurationStr(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [statusData]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await checkInAttendance();
      await loadStatus();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      await checkOutAttendance();
      await loadStatus();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  const isCheckedIn = statusData?.isCheckedIn || false;
  const activeSession = statusData?.activeAttendance;
  const emp = statusData?.employee;
  const displayName = emp
    ? `${emp.firstName} ${emp.lastName}`
    : user?.email.split('@')[0] || 'User';

  if (loading) {
    return (
      <div className="p-4 bg-slate-900 text-slate-400 rounded-2xl text-xs animate-pulse flex items-center justify-between">
        <span>Loading attendance status...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-3">
        <button
          onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
          disabled={actionLoading}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-sm ${
            isCheckedIn
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isCheckedIn ? 'bg-white animate-ping' : 'bg-white'
            }`}
          ></span>
          {actionLoading
            ? 'Updating...'
            : isCheckedIn
            ? `Check Out (${liveDurationStr})`
            : 'Check In'}
        </button>
      </div>
    );
  }

  const checkInFormattedTime = activeSession?.checkIn
    ? new Date(activeSession.checkIn).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 space-y-4">
      {/* Widget Header & User Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Attendance Widget
          </span>
          <h2 className="text-xl font-extrabold text-white mt-0.5">
            Welcome back, {displayName}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${
              isCheckedIn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`}
          ></span>
          <span className="text-xs font-semibold text-slate-300">
            {isCheckedIn ? 'Checked In' : 'Checked Out'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/20 border border-rose-500/50 text-rose-200 rounded-xl text-xs font-semibold">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Session Details Grid */}
      <div className="grid grid-cols-2 gap-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700/60">
        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase">
            Current Session
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {isCheckedIn && checkInFormattedTime
              ? `${checkInFormattedTime} — Now`
              : 'No Active Session'}
          </div>
          <div className="text-xs font-mono font-bold text-indigo-300 mt-0.5">
            {isCheckedIn ? liveDurationStr : '00:00:00'}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-400 uppercase">
            Today Total
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {statusData?.todayWorkedHours ?? 0} hrs
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {isCheckedIn ? 'Session active' : 'Completed for today'}
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="pt-1">
        {isCheckedIn ? (
          <button
            onClick={handleCheckOut}
            disabled={actionLoading}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>🛑</span>
            <span>{actionLoading ? 'Saving Check-Out...' : 'Check Out'}</span>
          </button>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={actionLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>▶</span>
            <span>{actionLoading ? 'Recording Check-In...' : 'Check In'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AttendanceWidget;
