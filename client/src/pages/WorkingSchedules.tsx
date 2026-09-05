import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchSchedules, fetchSchedule, createSchedule, updateSchedule,
  type WorkingSchedule, type ScheduleLine
} from '../api/hr';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function calcHours(lines: ScheduleLine[]): number {
  let total = 0;
  for (const line of lines) {
    if (!line.timeFrom || !line.timeTo) continue;
    const [fh, fm] = line.timeFrom.split(':').map(Number);
    const [th, tm] = line.timeTo.split(':').map(Number);
    let h = (th + tm / 60) - (fh + fm / 60);
    if (h < 0) h += 24;
    total += h;
  }
  return Math.round(total * 100) / 100;
}

const emptyLine = (): ScheduleLine => ({ dayOfWeek: 'MONDAY', timeFrom: '09:00', timeTo: '17:00' });

function ScheduleForm({
  initial,
  readOnly = false,
  onSave,
  onCancel,
}: {
  initial: WorkingSchedule | null;
  readOnly?: boolean;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [flexible, setFlexible] = useState(initial?.flexibleHours || false);
  const [lines, setLines] = useState<ScheduleLine[]>(
    initial?.scheduleLines?.length ? initial.scheduleLines : [emptyLine()]
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setLine = (i: number, key: keyof ScheduleLine, val: string) => {
    if (readOnly) return;
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  };

  const addLine = () => !readOnly && setLines(ls => [...ls, emptyLine()]);
  const removeLine = (i: number) => !readOnly && setLines(ls => ls.filter((_, idx) => idx !== i));

  const totalHours = calcHours(lines);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        flexibleHours: flexible,
        scheduleLines: lines.map(({ id, ...rest }) => rest),
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Name *</label>
        <input
          disabled={readOnly}
          required
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
          placeholder="e.g. Standard 40 Hours"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          disabled={readOnly}
          type="checkbox"
          id="flexible"
          checked={flexible}
          onChange={e => setFlexible(e.target.checked)}
          className="rounded text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="flexible" className="text-sm font-medium text-slate-700">Flexible Hours</label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">Day & Time Schedule</label>
          <span className="text-xs text-slate-500 font-medium">Calculated: {totalHours}h / week</span>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <select
                disabled={readOnly}
                value={line.dayOfWeek}
                onChange={e => setLine(i, 'dayOfWeek', e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 disabled:bg-slate-100"
              >
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input
                disabled={readOnly}
                type="time"
                value={line.timeFrom}
                onChange={e => setLine(i, 'timeFrom', e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                disabled={readOnly}
                type="time"
                value={line.timeTo}
                onChange={e => setLine(i, 'timeTo', e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
              />
              {!readOnly && lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="text-red-500 hover:text-red-700 px-1"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={addLine}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + Add Another Day Line
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        {!readOnly && (
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className={`${readOnly ? 'w-full' : 'flex-1'} px-4 py-2 border border-slate-300 rounded hover:bg-slate-50`}
        >
          {readOnly ? 'Close' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}

export default function SchedulesPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'HR_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';

  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSchedule, setEditSchedule] = useState<WorkingSchedule | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await fetchSchedules();
    setSchedules(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: any) => {
    if (editSchedule) {
      await updateSchedule(editSchedule.id, data);
    } else {
      await createSchedule(data);
    }
    await load();
    setShowForm(false);
    setEditSchedule(null);
  };

  const openEdit = async (s: WorkingSchedule) => {
    const full = await fetchSchedule(s.id);
    setEditSchedule(full);
    setShowForm(true);
  };

  const [search, setSearch] = useState('');

  const filteredSchedules = schedules.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Working Schedules</h1>
          <p className="text-sm text-slate-500 mt-1">Company shift patterns and working hours</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditSchedule(null); setShowForm(true); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            + New Schedule
          </button>
        )}
      </div>

      {/* Elasticsearch Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="text-indigo-600 font-semibold text-xs uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">
          <span>🔍</span> Elasticsearch
        </div>
        <input
          type="text"
          placeholder="Search working schedules by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-2xl mx-4">
            <h2 className="text-lg font-bold mb-4 text-slate-800">
              {canEdit ? (editSchedule ? 'Edit Schedule' : 'New Schedule') : 'Schedule Details'}
            </h2>
            <ScheduleForm
              initial={editSchedule}
              readOnly={!canEdit}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditSchedule(null); }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading schedules...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSchedules.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{s.name}</h3>
                  {s.flexibleHours && (
                    <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">Flexible</span>
                  )}
                </div>
                <button
                  onClick={() => openEdit(s)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  {canEdit ? 'Edit' : 'View'}
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <span className="font-semibold text-lg text-slate-800">{s.hoursPerWeek}h</span>
                <span className="text-slate-400">per week</span>
              </div>
              <div className="mt-3 flex gap-3 text-xs text-slate-500">
                <span>{s._count?.scheduleLines ?? s.scheduleLines?.length ?? 0} active days</span>
                <span>·</span>
                <span>{s._count?.contracts ?? 0} linked contracts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
