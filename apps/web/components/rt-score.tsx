export function RtScore({ critic }: { critic: number | null }) {
  if (critic == null) return null;
  return (
    <div>
      <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-1">Tomatometer</p>
      <p className="text-white text-base">{critic}%</p>
    </div>
  );
}
