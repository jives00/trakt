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
  const [addingWatch, setAddingWatch] = useState(false);
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
      onMark(dateToUtcNoon(releaseDate));
    }
    setIsOpen(false);
  };

  const handleConfirmDate = () => {
    onMark(dateToUtcNoon(selectedDate));
    setIsOpen(false);
    setShowDateInput(false);
    setSelectedDate(getTodayString());
  };

  if (watched) {
    return (
      <div ref={containerRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-accent/30 border border-accent/60 text-white hover:bg-accent/40 transition-colors font-semibold"
        >
          <span className="material-symbols-outlined text-base">check_circle</span>
          Watched
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[rgba(8,43,95,0.9)] border border-accent/60 rounded-md shadow-lg z-50 overflow-hidden">
            {addingWatch ? (
              <div className="p-3 border-b border-accent/60">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 px-2 py-1 rounded bg-black/60 border border-accent/60 text-white text-sm"
                  />
                  <button
                    onClick={() => {
                      onMark(dateToUtcNoon(selectedDate));
                      setIsOpen(false);
                      setAddingWatch(false);
                      setSelectedDate(getTodayString());
                    }}
                    className="px-2 py-1 rounded bg-accent text-white text-sm hover:bg-accent-hover transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    onMark(getTodayString());
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-accent/20 transition-colors"
                >
                  Add Watch (Today)
                </button>

                {(releaseDate || useReleaseDate) && (
                  <button
                    onClick={() => {
                      handleMarkReleaseDate();
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-accent/20 transition-colors border-t border-accent/60"
                  >
                    Add Watch ({releaseDateLabel})
                  </button>
                )}

                <button
                  onClick={() => {
                    setAddingWatch(true);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-accent/20 transition-colors border-t border-accent/60"
                >
                  Pick Date
                </button>
              </>
            )}

            {!addingWatch && (onRemoveLatest || onRemoveAll) && (
              <div className="border-t border-accent/60">
                {onRemoveLatest && latestEntryId ? (
                  <button
                    onClick={() => {
                      onRemoveLatest(latestEntryId);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-accent/20 transition-colors"
                  >
                    Remove Latest
                  </button>
                ) : null}
                {onRemoveAll ? (
                  <button
                    onClick={() => {
                      onRemoveAll();
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm text-white hover:bg-accent/20 transition-colors ${onRemoveLatest && latestEntryId ? 'border-t border-accent/60' : ''}`}
                  >
                    Remove All
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-0">
        <button
          onClick={handleMarkToday}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-accent/30 border border-accent/60 text-white hover:bg-accent/40 transition-colors font-semibold ${isOpen ? 'rounded-tl-md' : 'rounded-l-md'}`}
        >
          <span className="material-symbols-outlined text-base">check_circle</span>
          Mark Watched
        </button>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-2 py-2 bg-accent/30 border border-l-0 border-accent/60 text-white hover:bg-accent/40 transition-colors text-xs ${isOpen ? 'rounded-tr-md' : 'rounded-r-md'}`}
        >
          ▾
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[rgba(8,43,95,0.9)] border border-accent/60 rounded-b-md shadow-lg z-50 overflow-hidden">
          {showDateInput ? (
            <div className="p-3 border-b border-accent/60">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-black/60 border border-accent/60 text-white text-sm"
                />
                <button
                  onClick={handleConfirmDate}
                  className="px-2 py-1 rounded bg-accent text-white text-sm hover:bg-accent-hover transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handleMarkToday}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-accent/20 transition-colors"
              >
                Today
              </button>

              {(releaseDate || useReleaseDate) && (
                <button
                  onClick={handleMarkReleaseDate}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-accent/20 transition-colors border-t border-accent/60"
                >
                  {releaseDateLabel}
                </button>
              )}

              <button
                onClick={() => setShowDateInput(true)}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-accent/20 transition-colors border-t border-accent/60"
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
  // Full UTC datetime so MySQL stores the actual moment, not midnight UTC (which would
  // display as yesterday in negative-offset timezones like CDT).
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function dateToUtcNoon(dateStr: string): string {
  // Store user-picked dates at noon UTC so they survive any UTC± timezone without
  // rolling back to the previous calendar day.
  return new Date(dateStr + 'T12:00:00Z').toISOString().slice(0, 19).replace('T', ' ');
}
