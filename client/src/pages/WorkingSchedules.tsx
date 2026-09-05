import { useState, useEffect } from 'react';
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
  onSave,
  onCancel,
}: {
  initial: WorkingSchedule | null;
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
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  };

  const addLine = () => setLines(ls => [...ls, emptyLine()]);
  const removeLine = (i: number) => setLines(ls => ls.filter((_, idx) => idx !== i));

  const totalHours = calcHours(lines);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 cursor-pointer mt-6">
            <input type="checkbox" checked={flexible} onChange={e => setFlexible(e.target.checked)}
              className="w-4 h-4 accent-indigo-600" />
            <span className="text-sm text-slate-700">Flexible Hours</span>
          </label>
        </div>
      </div>

      {/* Schedule Lines Table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Weekly Pattern</h3>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              Total: <strong className="text-indigo-600">{totalHours}h/week</strong>
            </span>
            <button type="button" onClick={addLine}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              + Add Day
            </button>
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Day</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">From</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">To</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Hours</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, i) => {
                const [fh, fm] = line.timeFrom?.split(':').map(Number) ?? [0, 0];
                const [th, tm] = line.timeTo?.split(':').map(Number) ?? [0, 0];
                let h = (th + tm / 60) - (fh + fm / 60);
                if (h < 0) h += 24;
                return (
                  <tr key={i} className="bg-white">
                    <td className="px-4 py-2">
                      <select value={line.dayOfWeek} onChange={e => setLine(i, 'dayOfWeek', e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400">
                        {DAYS.map(d => <option key={d} value={d}>{d.slice(0, 3)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input type="time" value={line.timeFrom} onChange={e => setLine(i, 'timeFrom', e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="time" value={line.timeTo} onChange={e => setLine(i, 'timeTo', e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-500">{Math.round(h * 100) / 100}h</td>
                    <td className="px-4 py-2">
                      <button type="button" onClick={() => removeLine(i)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 border border-slate-300 rounded hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSchedule, setEditSchedule] = useState<WorkingSchedule | null>(null);

  const load = async () => {
    setLoading(true);
    setSchedules(await fetchSchedules());
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Working Schedules</h1>
        <button onClick={() => { setEditSchedule(null); setShowForm(true); }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          + New Schedule
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-2xl mx-4">
            <h2 className="text-lg font-bold mb-4 text-slate-800">
              {editSchedule ? 'Edit Schedule' : 'New Schedule'}
            </h2>
            <ScheduleForm
              initial={editSchedule}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditSchedule(null); }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {schedules.map(s => (
            <div key={s.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{s.name}</h3>
                  {s.flexibleHours && (
                    <span className="text-xs text-indigo-600 font-medium">Flexible</span>
                  )}
                </div>
                <button onClick={() => openEdit(s)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <span className="font-semibold text-lg text-slate-800">{s.hoursPerWeek}h</span>
                <span className="text-slate-400">per week</span>
              </div>
              <div className="mt-3 flex gap-3 text-xs text-slate-500">
                <span>{s._count?.scheduleLines ?? 0} days</span>
                <span>·</span>
                <span>{s._count?.contracts ?? 0} contracts</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
