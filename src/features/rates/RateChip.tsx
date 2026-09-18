import { CloudOff, PencilLine, TriangleAlert } from 'lucide-react';
import { cx } from '../../lib/cx';
import { useUI } from '../../store/ui';
import { useRateStatus } from './useRateStatus';

export function RateChip() {
  const { status } = useRateStatus();
  const setPanel = useUI((s) => s.setPanel);
  const warn = status.state !== 'ok';
  const Icon = status.state === 'offline' ? CloudOff : warn ? TriangleAlert : status.manual ? PencilLine : null;

  return (
    <button
      type="button"
      onClick={() => setPanel('rates')}
      aria-label={`${status.chip}${status.manual ? ', cargada a mano' : ''}${status.detail ? `. ${status.detail}` : ''}. Ver cotización`}
      className="group flex min-h-11 shrink-0 items-center"
    >
      {/* El área tocable mide 44px de alto; el chip visible es más chico. */}
      <span
        className={cx(
          'tabular flex min-h-8 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-[11px] transition-colors duration-150 group-active:bg-raised',
          warn ? 'border-warn/40 text-warn' : 'border-line text-muted',
        )}
      >
        {Icon && <Icon size={12} strokeWidth={1.75} aria-hidden="true" />}
        {status.chip}
      </span>
    </button>
  );
}
