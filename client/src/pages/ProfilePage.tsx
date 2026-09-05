import { useState, useEffect } from 'react';
import { fetchMyProfile, updateMyProfile, type Employee } from '../api/hr';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Editable form fields
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    color: '#6366f1'
  });

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await fetchMyProfile();
      setProfile(data);
      setForm({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : '',
        color: data.color || '#6366f1'
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await updateMyProfile(form);
      setSuccessMsg('Profile updated successfully!');
      await loadProfile(); // Refresh to get updated data
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500">Loading your profile...</div>;

  if (!profile) {
    return (
      <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg border border-yellow-200">
        Your user account has not been linked to an Employee record yet. Please contact HR.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}
      {successMsg && <div className="p-4 bg-green-50 text-green-700 rounded-lg">{successMsg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Read-Only HR Information Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col items-center mb-6">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-inner"
                style={{ backgroundColor: profile.color || '#6366f1' }}
              >
                {profile.firstName[0]}{profile.lastName[0]}
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-800">{profile.firstName} {profile.lastName}</h2>
              <p className="text-sm text-slate-500">{profile.jobTitle}</p>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-slate-500 mb-1">Employee Number</p>
                <p className="font-medium text-slate-800">#{profile.employeeNumber}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Department</p>
                <p className="font-medium text-slate-800">{profile.department || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Manager</p>
                <p className="font-medium text-slate-800">
                  {profile.manager ? `${profile.manager.firstName} ${profile.manager.lastName}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Hire Date</p>
                <p className="font-medium text-slate-800">{new Date(profile.hireDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">Login Email</p>
                <p className="font-medium text-slate-800">{profile.user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Editable Personal Information */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold text-slate-800">Personal Information</h2>
              <p className="text-xs text-slate-500 mt-1">Update your basic profile details here.</p>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">First Name</label>
                  <input
                    required
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Last Name</label>
                  <input
                    required
                    value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={e => setForm({ ...form, dateOfBirth: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Profile Avatar Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.color}
                      onChange={e => setForm({ ...form, color: e.target.value })}
                      className="h-11 w-16 rounded cursor-pointer border border-slate-300 p-1"
                    />
                    <span className="text-sm text-slate-500 uppercase">{form.color}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
