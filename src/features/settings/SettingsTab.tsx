import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, FlaskConical, type LucideIcon, Coins, KeyRound, Repeat, Save, Tags, Wallet, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { clearDemoData, hasDemoData, loadDemoData } from '../../db/demo';
import { todayISO } from '../../lib/dates';
import { toast } from '../../store/toast';
import { useUI, type Panel } from '../../store/ui';
import { useRateStatus } from '../rates/useRateStatus';

export function SettingsTab() {
  return (
    <div className="scroll-area h-full space-y-6 px-5 pt-2 pb-28">
      <Group title="Movimientos">
        <PanelRow icon={Repeat} label="Recurrentes" hint="Ver, editar, pausar" panel="recurring" />
        <PanelRow icon={Wallet} label="Presupuestos" hint="Topes mensuales" panel="budgets" />
      </Group>

      <Group title="Cotización">
        <RateRow />
      </Group>

      <DemoSection />

      <Group title="Próximamente">
        <Row icon={Tags} label="Categorías" hint="Fase 5" />
        <Row icon={Coins} label="Moneda" hint="Fase 5" />
        <Row icon={KeyRound} label="Seguridad: PIN y Face ID" hint="Fase 5" />
        <Row icon={Save} label="Respaldo e importación" hint="Fase 5" />
      </Group>

      <p className="px-1 text-[12px] leading-relaxed text-muted">
        Tus datos se guardan solo en este dispositivo. No hay servidores ni cuentas: nadie más puede verlos.
      </p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] text-muted">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, hint }: { icon: LucideIcon; label: string; hint?: string }) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 text-[15px] text-muted">
      <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[12px]">{hint}</span>}
      <ChevronRight size={16} strokeWidth={1.5} className="opacity-40" aria-hidden="true" />
    </div>
  );
}

function PanelRow({ icon: Icon, label, hint, panel }: { icon: LucideIcon; label: string; hint: string; panel: Panel }) {
  const setPanel = useUI((s) => s.setPanel);
  return (
    <button type="button" onClick={() => setPanel(panel)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-raised">
      <Icon size={18} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="flex-1 text-[15px]">{label}</span>
      <span className="text-[12px] text-muted">{hint}</span>
      <ChevronRight size={16} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
    </button>
  );
}

function RateRow() {
  const setPanel = useUI((s) => s.setPanel);
  const { status } = useRateStatus();
  return (
    <button
      type="button"
      onClick={() => setPanel('rates')}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-raised"
    >
      <RefreshCw size={18} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">Dólar BROU</span>
        <span className={`tabular block truncate text-[12px] ${status.state === 'ok' ? 'text-muted' : 'text-warn'}`}>
          {status.chip}
        </span>
      </span>
      <span className="text-[12px] text-muted">Histórico y manual</span>
      <ChevronRight size={16} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
    </button>
  );
}

function DemoSection() {
  const loaded = useLiveQuery(hasDemoData, [], undefined);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const r = await loadDemoData(todayISO());
      toast(`Listo: ${r.transactions} movimientos de ejemplo`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudieron cargar los datos');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Group title="Datos de ejemplo">
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <FlaskConical size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-[14px] text-muted">
            Seis meses de movimientos inventados para ver la app llena. Se borran sin tocar lo que cargaste vos.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || loaded === undefined}
          onClick={() => (loaded ? setConfirm(true) : void load())}
          className="mt-3 min-h-11 w-full rounded-full border border-line text-[15px] transition-opacity active:bg-raised disabled:opacity-50"
        >
          {loaded ? 'Borrar datos demo' : busy ? 'Cargando…' : 'Cargar datos demo'}
        </button>
      </div>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Borrar datos de ejemplo"
        message="Se borran los movimientos y las categorías de ejemplo. Tus movimientos reales no se tocan."
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          const r = await clearDemoData();
          toast(`Se borraron ${r.transactions} movimientos de ejemplo`);
        }}
      />
    </Group>
  );
}
