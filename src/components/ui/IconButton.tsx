import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150',
        'active:bg-raised disabled:opacity-30',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
