import { useMemo } from 'react';
import { useRates } from '../../db/hooks';
import { latestRate } from '../../domain/fx';
import { todayISO } from '../../lib/dates';
import { useOnline } from '../../lib/online';
import { describeRateStatus } from './status';
import { useRatesSync } from './sync';

export function useRateStatus() {
  const rates = useRates();
  const online = useOnline();
  const sync = useRatesSync();
  const latest = useMemo(() => latestRate(rates), [rates]);
  const status = describeRateStatus({ latest, today: todayISO(), online, sync });
  return { rates, latest, online, sync, status };
}
