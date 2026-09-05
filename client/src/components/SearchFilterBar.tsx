import React from 'react';

export interface FilterOption {
  key: string;
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  sortOption?: string;
  onSortChange?: (sort: string) => void;
  sortOptions?: Array<{ label: string; value: string }>;
  activeFilterChips?: Array<{ label: string; value: string; onClear: () => void }>;
  onClearAll?: () => void;
  resultsCount?: number;
  totalCount?: number;
  unitName?: string;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  filters = [],
  sortOption,
  onSortChange,
  sortOptions = [],
  activeFilterChips = [],
  onClearAll,
  resultsCount,
  totalCount,
  unitName = 'records',
}) => {
  const hasActiveFilters = searchQuery.trim() !== '' || activeFilterChips.length > 0;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 w-full min-w-0">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
            🔍
          </div>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-11 pr-10 py-3 text-sm font-semibold bg-white text-slate-900 border border-slate-300 rounded-xl shadow-2xs hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdown Filters & Sort Options */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
          {filters.map((f) => (
            <div key={f.key} className="relative min-w-[140px] flex-1 sm:flex-initial">
              <select
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className={`w-full py-3 px-4 pr-9 text-xs sm:text-sm font-bold rounded-xl border transition-all cursor-pointer appearance-none shadow-2xs ${
                  f.value !== 'ALL' && f.value !== ''
                    ? 'bg-indigo-50/60 border-indigo-300 text-indigo-950 font-extrabold ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-300 text-slate-800 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500'
                }`}
              >
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-bold text-[10px]">
                ▼
              </div>
            </div>
          ))}

          {/* Sort Selector */}
          {sortOptions.length > 0 && onSortChange && (
            <div className="relative min-w-[140px] flex-1 sm:flex-initial">
              <select
                value={sortOption}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full py-3 px-4 pr-9 text-xs sm:text-sm font-bold bg-white text-slate-800 border border-slate-300 rounded-xl hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer appearance-none shadow-2xs"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 font-bold text-[10px]">
                ▼
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Filter Chips & Result Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {searchQuery && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg font-semibold">
              Search: "{searchQuery}"
              <button onClick={() => onSearchChange('')} className="hover:text-indigo-950 font-bold">
                ×
              </button>
            </span>
          )}

          {activeFilterChips.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg font-semibold"
            >
              {chip.label}: {chip.value}
              <button onClick={chip.onClear} className="hover:text-indigo-950 font-bold">
                ×
              </button>
            </span>
          ))}

          {hasActiveFilters && onClearAll && (
            <button
              onClick={onClearAll}
              className="text-indigo-600 hover:text-indigo-800 font-bold text-xs px-2 py-1 transition"
            >
              Clear All
            </button>
          )}
        </div>

        {resultsCount !== undefined && (
          <div className="text-slate-500 font-semibold whitespace-nowrap">
            Showing {resultsCount} {totalCount !== undefined ? `of ${totalCount}` : ''} {unitName}
          </div>
        )}
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  actionButton?: React.ReactNode;
}> = ({
  title = 'No Records Found',
  description = 'No results match your search or filter criteria.',
  hasActiveFilters = false,
  onClearFilters,
  actionButton,
}) => {
  return (
    <div className="p-12 text-center space-y-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-bold">
        🔍
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">{description}</p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        {hasActiveFilters && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition"
          >
            Clear Filters
          </button>
        )}
        {actionButton}
      </div>
    </div>
  );
};
