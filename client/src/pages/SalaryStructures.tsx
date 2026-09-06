import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchSalaryStructures,
  createSalaryStructure,
  updateSalaryStructure,
  type SalaryStructure,
} from '../api/hr';
import { SearchFilterBar, EmptyState } from '../components/SearchFilterBar';
import Pagination from '../components/Pagination';

export default function SalaryStructures() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const canManage = user?.role === 'ADMIN' || user?.role === 'HR_PAYROLL_MANAGER' || user?.role === 'HR_PAYROLL_ADMIN';

  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [effectiveFilter, setEffectiveFilter] = useState<string>('ALL');
  const [sortOption, setSortOption] = useState<string>('NAME_ASC');

  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, effectiveFilter, sortOption]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState<string>('');
  const [formEffectiveTo, setFormEffectiveTo] = useState<string>('');

  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadStructures = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSalaryStructures();
      setStructures(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load salary structures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStructures();
  }, []);

  const openEditModal = (struct: SalaryStructure) => {
    setEditingStructure(struct);
    setFormName(struct.name);
    setFormCode(struct.code);
    setFormDescription(struct.description || '');
    setFormStatus(struct.status);
    setFormEffectiveFrom(struct.effectiveFrom ? struct.effectiveFrom.slice(0, 10) : '');
    setFormEffectiveTo(struct.effectiveTo ? struct.effectiveTo.slice(0, 10) : '');
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingStructure(null);
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Structure Name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Structure Code/ID is required.');
      return;
    }
    if (!formEffectiveFrom) {
      setFormError('Effective From date is required.');
      return;
    }

    if (formEffectiveTo && new Date(formEffectiveTo) < new Date(formEffectiveFrom)) {
      setFormError('Effective To date cannot be earlier than Effective From date.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<SalaryStructure> = {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        description: formDescription.trim() || null,
        status: formStatus,
        effectiveFrom: new Date(formEffectiveFrom).toISOString(),
        effectiveTo: formEffectiveTo ? new Date(formEffectiveTo).toISOString() : null,
      };

      if (editingStructure) {
        await updateSalaryStructure(editingStructure.id, payload);
        setSuccessMessage(`Salary structure "${formName}" updated successfully.`);
        closeModal();
        loadStructures();
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        const created = await createSalaryStructure(payload);
        closeModal();
        navigate(`/salary-structures/${created.id}`);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save salary structure.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (struct: SalaryStructure) => {
    const newStatus = struct.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateSalaryStructure(struct.id, { status: newStatus });
      setSuccessMessage(
        `Salary structure "${struct.name}" is now ${newStatus.toLowerCase()}.`
      );
      loadStructures();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update structure status.');
    }
  };

  // Combined Search & Filter Logic
  const filteredStructures = useMemo(() => {
    const today = new Date();
    let result = structures.filter((s) => {
      // Search: Name, Code, Description
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q));

      // Status Filter: ACTIVE / INACTIVE
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;

      // Effective Status Filter: CURRENT / HISTORICAL
      let matchesEffective = true;
      if (effectiveFilter === 'CURRENT') {
        const effTo = s.effectiveTo ? new Date(s.effectiveTo) : null;
        matchesEffective = !effTo || effTo >= today;
      } else if (effectiveFilter === 'HISTORICAL') {
        const effTo = s.effectiveTo ? new Date(s.effectiveTo) : null;
        matchesEffective = Boolean(effTo && effTo < today);
      }

      return matchesSearch && matchesStatus && matchesEffective;
    });

    // Sorting Options
    result.sort((a, b) => {
      if (sortOption === 'NAME_ASC') {
        return a.name.localeCompare(b.name);
      } else if (sortOption === 'RULES_DESC') {
        const rA = a._count?.rules ?? a.rules?.length ?? 0;
        const rB = b._count?.rules ?? b.rules?.length ?? 0;
        return rB - rA;
      } else if (sortOption === 'EMP_DESC') {
        const eA = a._count?.contracts ?? 0;
        const eB = b._count?.contracts ?? 0;
        return eB - eA;
      } else if (sortOption === 'CODE_ASC') {
        return a.code.localeCompare(b.code);
      }
      return 0;
    });

    return result;
  }, [structures, search, statusFilter, effectiveFilter, sortOption]);

  const paginatedStructures = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStructures.slice(start, start + pageSize);
  }, [filteredStructures, page, pageSize]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; value: string; onClear: () => void }> = [];
    if (statusFilter !== 'ALL') chips.push({ label: 'Status', value: statusFilter, onClear: () => setStatusFilter('ALL') });
    if (effectiveFilter !== 'ALL') chips.push({ label: 'Effective', value: effectiveFilter, onClear: () => setEffectiveFilter('ALL') });
    return chips;
  }, [statusFilter, effectiveFilter]);

  const handleClearAllFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setEffectiveFilter('ALL');
    setSortOption('NAME_ASC');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Salary Structures</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure employee compensation structures, validity periods, and calculation rules.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => navigate('/salary-structures/new')}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition whitespace-nowrap"
          >
            + Create Structure
          </button>
        )}
      </div>

      {!canManage && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center justify-between">
          <span>🔒 Read-Only Access: Salary structures are managed strictly by HR Payroll Manager.</span>
        </div>
      )}

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-600 hover:text-emerald-900 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-900 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Unified Search & Filter Control Bar */}
      <SearchFilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search structures by name, code/ID, or description..."
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            options: [
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Active Only', value: 'ACTIVE' },
              { label: 'Inactive Only', value: 'INACTIVE' },
            ],
            onChange: setStatusFilter,
          },
          {
            key: 'effective',
            label: 'Effective Period',
            value: effectiveFilter,
            options: [
              { label: 'All Periods', value: 'ALL' },
              { label: 'Current / Ongoing', value: 'CURRENT' },
              { label: 'Historical / Expired', value: 'HISTORICAL' },
            ],
            onChange: setEffectiveFilter,
          },
        ]}
        sortOption={sortOption}
        onSortChange={setSortOption}
        sortOptions={[
          { label: 'Sort: Name (A-Z)', value: 'NAME_ASC' },
          { label: 'Sort: Rule Count', value: 'RULES_DESC' },
          { label: 'Sort: Employee Count', value: 'EMP_DESC' },
          { label: 'Sort: Structure Code', value: 'CODE_ASC' },
        ]}
        activeFilterChips={activeFilterChips}
        onClearAll={handleClearAllFilters}
        resultsCount={filteredStructures.length}
        totalCount={structures.length}
        unitName="salary structures"
      />

      {/* Content Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
            <p className="text-sm font-medium">Loading salary structures...</p>
          </div>
        ) : filteredStructures.length === 0 ? (
          <EmptyState
            title="No Salary Structures Found"
            description="No salary structures match your search query or selected status filter."
            hasActiveFilters={search.trim() !== '' || activeFilterChips.length > 0}
            onClearFilters={handleClearAllFilters}
            actionButton={
              canManage ? (
                <button
                  onClick={() => navigate('/salary-structures/new')}
                  className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition"
                >
                  + Create Salary Structure
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Structure Name</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-center">Rules</th>
                  <th className="px-6 py-3.5 text-center">Assigned Employees</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedStructures.map((struct) => {
                  const ruleCount = struct._count?.rules ?? struct.rules?.length ?? 0;
                  const empCount = struct._count?.contracts ?? 0;
                  const isActive = struct.status === 'ACTIVE';

                  return (
                    <tr key={struct.id} className="hover:bg-indigo-50/40 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{struct.name}</div>
                        {struct.description ? (
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5 font-normal">
                            {struct.description}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic mt-0.5 font-normal">
                            No description provided
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ● Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            ○ Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {empCount} {empCount === 1 ? 'employee' : 'employees'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => navigate(`/salary-structures/${struct.id}`)}
                          className="px-3 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                        >
                          View Structure
                        </button>

                        {canManage && (
                          <>
                            <button
                              onClick={() => openEditModal(struct)}
                              className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleStatus(struct)}
                              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                                isActive
                                  ? 'text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={filteredStructures.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Structure Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-7 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl font-black text-slate-900">
                {editingStructure ? 'Edit Salary Structure' : 'Create Salary Structure'}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Structure Name */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Structure Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Executive Structure"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              {/* Structure ID / Code */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Structure Code / ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EXEC_2026"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-normal">
                  Unique identifier used for payroll calculation references.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details regarding eligibility or grade..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-normal"
                />
              </div>

              {/* Status & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Status *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    required
                    value={formEffectiveFrom}
                    onChange={(e) => setFormEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Effective To
                  </label>
                  <input
                    type="date"
                    value={formEffectiveTo}
                    onChange={(e) => setFormEffectiveTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : editingStructure ? 'Update Structure' : 'Create Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
