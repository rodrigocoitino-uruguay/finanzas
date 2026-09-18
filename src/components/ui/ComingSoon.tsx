import type { LucideIcon } from 'lucide-react';

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  items: string[];
  phase: number;
}

/** Marcador temporal para las pestañas que se construyen en fases siguientes. */
export function ComingSoon({ icon: Icon, title, items, phase }: ComingSoonProps) {
  return (
    <div className="flex h-full flex-col justify-center px-6 pb-24">
      <div className="rounded-card border border-line bg-surface p-6">
        <Icon size={28} strokeWidth={1.2} className="text-muted" aria-hidden="true" />
        <p className="mt-4 font-display text-[22px] font-semibold leading-tight tracking-tight">{title}</p>
        <p className="mt-1 text-[13px] text-muted">Llega en la fase {phase}</p>
        <ul className="mt-4 space-y-1.5 text-[14px] text-muted">
          {items.map((i) => (
            <li key={i}>· {i}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
