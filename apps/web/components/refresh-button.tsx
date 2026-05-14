'use client';

import { useState, useRef, useEffect } from 'react';

export interface RefreshSection {
  label: string;
  onRefresh: () => Promise<void>;
}

interface Props {
  sections: RefreshSection[];
  className?: string;
}

export function RefreshButton({ sections, className = '' }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleRefresh(section: RefreshSection) {
    try {
      setLoading(section.label);
      await section.onRefresh();
    } finally {
      setLoading(null);
      setDropdownOpen(false);
    }
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div className="flex gap-0">
        {/* Main button */}
        <button
          onClick={() => handleRefresh(sections[0])}
          disabled={loading !== null}
          className="flex-1 py-3 rounded-l-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors bg-surface-container border border-outline-variant/40 text-on-surface/80 hover:bg-surface-container-high disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-sm animate-spin" style={{ fontVariationSettings: "'FILL' 0" }}>
                progress_activity
              </span>
              Refreshing…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>
                refresh
              </span>
              Refresh Data
            </>
          )}
        </button>

        {/* Dropdown toggle button */}
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          disabled={loading !== null}
          className="px-3 py-3 rounded-r-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center transition-colors bg-surface-container border border-l-0 border-outline-variant/40 text-on-surface/80 hover:bg-surface-container-high disabled:opacity-50"
          title="More options"
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>
            expand_more
          </span>
        </button>
      </div>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container border border-outline-variant/40 rounded-xl overflow-hidden shadow-lg z-50">
          {sections.map((section, idx) => (
            <button
              key={idx}
              onClick={() => handleRefresh(section)}
              disabled={loading !== null}
              className="w-full px-4 py-3 text-sm font-medium text-on-surface/80 hover:bg-on-surface/5 hover:text-on-surface transition-colors text-left disabled:opacity-50 border-b border-outline-variant/30 last:border-b-0"
            >
              {section.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
