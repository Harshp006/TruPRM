import React, { useState, useEffect } from 'react';
import {
  fetchMyProfile,
  updateMyProfile,
  fetchTimeOffTypes,
  fetchTimeOffAllocations,
  createTimeOffRequest,
  type Employee,
  type TimeOffType,
  type TimeOffAllocation,
} from '../api/hr';
import AttendanceToggleWidget from '../components/AttendanceToggleWidget';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Leave Request Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [timeOffTypes, setTimeOffTypes] = useState<TimeOffType[]>([]);
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    timeOffTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  // Profile Edit Form State
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    color: '#6366f1',
  });

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const data = await fetchMyProfile();
      setProfile(data);
      setForm({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '',
        color: data.color || '#6366f1',
      });

      // Load time off types and allocations for live leave balances
      if (data.id) {
        const [types, allocs] = await Promise.all([
          fetchTimeOffTypes().catch(() => []),
          fetchTimeOffAllocations({ employeeId: data.id }).catch(() => []),
        ]);
        setTimeOffTypes(types);
        setAllocations(allocs);
        if (types.length > 0 && !leaveForm.timeOffTypeId) {
          setLeaveForm(prev => ({ ...prev, timeOffTypeId: types[0].id }));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await updateMyProfile(form);
      setSuccessMsg('Profile updated successfully!');
      await loadProfileData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSubmittingLeave(true);
    setError('');
    try {
      await createTimeOffRequest({
        employeeId: profile.id,
        timeOffTypeId: leaveForm.timeOffTypeId,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
      });
      setSuccessMsg('Time off request submitted successfully!');
      setShowLeaveModal(false);
      setLeaveForm({
        timeOffTypeId: timeOffTypes[0]?.id || '',
        startDate: '',
        endDate: '',
        reason: '',
      });
      await loadProfileData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit time off request');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const formatRole = (role?: string) => {
    if (!role) return 'Employee';
    switch (role) {
      case 'HR_MANAGER':
        return 'HR Manager';
      case 'HR_PAYROLL_MANAGER':
      case 'HR_PAYROLL_ADMIN':
        return 'HR Payroll Manager';
      case 'HR_PAYROLL_USER':
        return 'HR Payroll User';
      case 'ADMIN':
        return 'Administrator';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-amber-50 text-amber-900 p-6 rounded-2xl border border-amber-200 shadow-sm max-w-xl mx-auto my-8">
        <h3 className="font-bold text-lg mb-1">Employee Profile Not Found</h3>
        <p className="text-sm">Your user account is not currently linked to an Employee record in TruPRM. Please contact your system administrator.</p>
      </div>
    );
  }

  const activeContract = profile.contracts?.find(c => c.status === 'ACTIVE') || profile.contracts?.[0];
  const workingSchedule = activeContract?.workingSchedule;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-extrabold shadow-inner"
            style={{ backgroundColor: profile.color || '#6366f1' }}
          >
            {profile.firstName?.[0] || 'U'}{profile.lastName?.[0] || ''}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{profile.firstName} {profile.lastName}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {formatRole(profile.user?.role)}
              </span>
            </div>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              {profile.jobTitle || 'Employee'} • {profile.department || 'General'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Employee ID: <strong className="text-slate-700">#{profile.employeeNumber}</strong> • Email: <strong className="text-slate-700">{profile.user?.email || 'N/A'}</strong>
            </p>
          </div>
        </div>

        {/* Quick Leave Request Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLeaveModal(true)}
            className="px-4 py-2.5 bg-brand-primary text-white font-semibold text-xs rounded-xl hover:bg-brand-primary/90 transition-colors shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Request Time Off</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-sm font-medium">
          {successMsg}
        </div>
      )}

      {/* Main Grid: Attendance & Leave Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Check-in Widget (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-slate-900 mb-1">Today's Attendance</h2>
          <p className="text-xs text-slate-500 mb-4">Record check-in and check-out times.</p>
          <AttendanceToggleWidget compact={false} onStatusChange={loadProfileData} />
        </div>

        {/* Live Leave Balances Cards (2 Cols) */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Leave Allocations & Balances</h2>
                <p className="text-xs text-slate-500">Your current time off allowances for the year.</p>
              </div>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="text-xs font-semibold text-brand-primary hover:underline"
              >
                Apply Leave
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {allocations.length === 0 ? (
                <div className="col-span-3 p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                  No active leave allocations found.
                </div>
              ) : (
                allocations.map(alloc => (
                  <div key={alloc.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      {alloc.timeOffType?.name || 'Leave'}
                    </span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xl font-extrabold text-slate-900">{alloc.remaining}d</span>
                      <span className="text-xs text-slate-400">of {alloc.daysAllocated}d</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-brand-primary h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (alloc.daysUsed / (alloc.daysAllocated || 1)) * 100)}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1.5 block">Used: {alloc.daysUsed} days</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Pending Requests: <strong className="text-slate-800">{profile.timeOffSummary?.pending || 0}</strong></span>
            <span>Approved Requests: <strong className="text-emerald-700">{profile.timeOffSummary?.approved || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* Details Grid: Contract & Org Info + Edit Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employment & Contract Overview (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Employment Details
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block uppercase font-medium text-[10px]">Manager</span>
              <span className="font-semibold text-slate-800">
                {profile.manager ? `${profile.manager.firstName} ${profile.manager.lastName}` : 'Direct Report to HR'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block uppercase font-medium text-[10px]">Hire Date</span>
              <span className="font-semibold text-slate-800">
                {profile.hireDate ? new Date(profile.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block uppercase font-medium text-[10px]">Active Contract</span>
              <span className="font-semibold text-slate-800">
                {activeContract ? `${activeContract.contractType} (${activeContract.status})` : 'No active contract'}
              </span>
            </div>

            {workingSchedule && (
              <div>
                <span className="text-slate-400 block uppercase font-medium text-[10px]">Working Schedule</span>
                <span className="font-semibold text-slate-800">
                  {workingSchedule.name} ({workingSchedule.hoursPerWeek} hrs/week)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Editable Personal Details Form (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
            Edit Personal Information
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={e => setForm({ ...form, firstName: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={form.lastName}
                  onChange={e => setForm({ ...form, lastName: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={e => setForm({ ...form, dateOfBirth: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Avatar Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="h-9 w-14 rounded-lg border border-slate-300 p-0.5 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-600 uppercase">{form.color}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-slate-900 text-white font-semibold text-xs rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal: New Leave Request */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900">Submit Time Off Request</h3>
              <button onClick={() => setShowLeaveModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeaveRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type</label>
                <select
                  value={leaveForm.timeOffTypeId}
                  onChange={e => setLeaveForm({ ...leaveForm, timeOffTypeId: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {timeOffTypes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.isPaid ? 'Paid' : 'Unpaid'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.startDate}
                    onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.endDate}
                    onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Remarks</label>
                <textarea
                  rows={3}
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Optional reason for request..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-4 py-2 bg-brand-primary text-white rounded-xl font-semibold text-xs hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {submittingLeave ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
