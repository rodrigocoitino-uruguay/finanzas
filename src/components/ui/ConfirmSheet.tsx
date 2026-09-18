import { useState } from 'react';
import { cx } from '../../lib/cx';
import { Sheet } from './Sheet';

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmSheet({ open, onClose, title, message, confirmLabel, destructive, onConfirm }: ConfirmSheetProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-[15px] text-muted">{message}</p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-full border border-line text-[15px] active:bg-raised">
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
          className={cx(
            'min-h-12 flex-1 rounded-full text-[15px] font-medium transition-opacity active:opacity-80',
            destructive ? 'bg-alert text-bg' : 'bg-fg text-bg',
            busy && 'opacity-60',
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
