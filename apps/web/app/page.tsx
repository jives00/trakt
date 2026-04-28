"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, type UpNextItem, type ScheduleEntry } from "@/lib/api";
import { UpNextSection } from "@/components/up-next-section";
import { ScheduleSection } from "@/components/schedule-section";

export default function DashboardPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!token) { router.replace("/login"); return; }

    Promise.all([api.getUpNext(token), api.getSchedule(token)])
      .then(([up, sched]) => { setUpNext(up); setSchedule(sched); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [token, isLoading, router]);

  if (isLoading || fetching) {
    return <p className="text-on-surface-variant">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <UpNextSection items={upNext} />
      <ScheduleSection entries={schedule} />
    </div>
  );
}
