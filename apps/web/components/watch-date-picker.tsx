'use client';

import { useEffect, useRef, useState } from 'react';

export interface WatchDatePickerProps {
  watched: boolean;
  releaseDate: string | null;
  onMark: (watchedAt: string) => void;
  onRemoveLatest?: (id: number) => void;
  onRemoveAll?: () => void;
  latestEntryId?: number | null;
  releaseDateLabel?: string;
  useReleaseDate?: boolean;
}

export function WatchDatePicker({
  watched,
  releaseDate,
  onMark,
  onRemoveLatest,
  onRemoveAll,
  latestEntryId,
  releaseDateLabel = 'Release Date',
  useReleaseDate = false,
}: WatchDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDateInput, setShowDateInput] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowDateInput(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMarkToday = () => {
    onMark(getTodayString());
    setIsOpen(false);
  };

  const handleMarkReleaseDate = () => {
    if (useReleaseDate) {
      onMark('release_date');
    } else if (releaseDate) {
      onMark(releaseDate);
    }
    setIsOpen(false);
  };

  const handleConfirmDate = () => {
    onMark(selectedDate);
    setIsOpen(false);
    setShowDateInput(false);
    setSelectedDate(getTodayString());
  };

  if (watched) {
    return (
      <div ref={containerRef} className="relative" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-red-900/30 border border-red-500/50 text-red-400 hover:bg-red-900/50 transition-colors text-sm font-medium"
        >
          <span className="material-symbols-outlined text-base">check_circle</span>
          Watched
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50 overflow-hidden">
            {onRemoveLatest && latestEntryId ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemoveLatest(latestEntryId);
                  setIsOpen(false);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Remove Latest
              </button>
            ) : null}
            {onRemoveAll ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemoveAll();
                  setIsOpen(false);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors border-t border-slate-700"
              >
                Remove All
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative" onMouseDown={(e) => {
      e.preventDefault();
      e.stopPropagation();
    }}>
      <div className="flex gap-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleMarkToday();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-l-md bg-red-900/30 border border-red-500/50 text-red-400 hover:bg-red-900/50 transition-colors text-sm font-medium"
        >
          <span className="material-symbols-outlined text-base">check_circle</span>
          Mark Watched
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="px-2 py-2 rounded-r-md bg-red-900/30 border border-l-0 border-red-500/50 text-red-400 hover:bg-red-900/50 transition-colors text-xs"
        >
          ▾
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50 overflow-hidden">
          {showDateInput ? (
            <div className="p-3 border-b border-slate-700">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-200 text-sm"
                />
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirmDate();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="px-2 py-1 rounded bg-red-900 text-red-200 text-sm hover:bg-red-800 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMarkToday();
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Today
              </button>

              {(releaseDate || useReleaseDate) && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMarkReleaseDate();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors border-t border-slate-700"
                >
                  {releaseDateLabel}
                </button>
              )}

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDateInput(true);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors border-t border-slate-700"
              >
                Pick Date
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}
