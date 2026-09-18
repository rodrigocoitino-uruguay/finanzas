import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronRight,
  FlaskConical,
  KeyRound,
  RefreshCw,
  Repeat,
  Save,
  Tags,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ConfirmSheet } from '../../components/ui/ConfirmSheet';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { wipeAllData } from '../../db/backup';
import { clearDemoData, hasDemoData, loadDemoData } from '../../db/demo';
import { updateSettings } from '../../db/settings';
import type { Currency } from '../../domain/types';
import { cx } from '../../lib/cx';
import { formatDate, todayISO } from '../../lib/dates';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { useUI, type Panel } from '../../store/ui';
import { useRateStatus } from '../rates/useRateStatus';

const CURRENCY_OPTIONS = [
  { value: 'UYU', label: 'UYU' },
  { value: 'USD', label: 'USD' },
] as const satisfies readonly { value: Currency; label: string }[];

export function SettingsTab() {
  const settings = useSettings();
  const rate = useRateStatus();
  const lockLabel = settings.pinHash
    ? `PIN activo${settings.webauthnCredentialId ? ' · Face ID' : ''}`
    : 'Sin bloqueo';
  const backupLabel = settings.lastBackupAt
    ? `Último: ${formatDate(settings.lastBackupAt.slice(0, 10), 'dd/MM')}`
    : 'Nunca';

  return (
    <div className="scroll-area h-full space-y-6 px-5 pt-2 pb-28">
      <Group title="Movimientos">
        <PanelRow icon={Tags} label="Categorías" hint="Nombre, color, fusionar" panel="categories" />
        <PanelRow icon={Repeat} label="Recurrentes" hint="Ver, editar, pausar" panel="recurring" />
        <PanelRow icon={Wallet} label="Presupuestos" hint="Topes mensuales" panel="budgets" />
      </Group>

      <Group title="Moneda">
        <CurrencyRow
          label="Mostrar montos en"
          value={settings.displayCurrency}
          onChange={(c) => {
            void updateSettings({ displayCurrency: c });
            useUI.getState().setDisplayCurrency(c);
          }}
        />
        <CurrencyRow
          label="Gastos nuevos en"
          value={settings.defaultExpenseCurrency}
          onChange={(c) => void updateSettings({ defaultExpenseCurrency: c })}
        />
        <CurrencyRow
          label="Ingresos nuevos en"
          value={settings.defaultIncomeCurrency}
          onChange={(c) => void updateSettings({ defaultIncomeCurrency: c })}
        />
      </Group>

      <Group title="Cotización">
        <PanelRow
          icon={RefreshCw}
          label="Dólar BROU"
          hint={rate.status.chip}
          panel="rates"
          warn={rate.status.state !== 'ok'}
        />
      </Group>

      <Group title="Seguridad y respaldo">
        <PanelRow icon={KeyRound} label="PIN y Face ID" hint={lockLabel} panel="security" />
        <PanelRow icon={Save} label="Respaldo e importación" hint={backupLabel} panel="backup" />
      </Group>

      <DataSection />

      <p className="px-1 text-[12px] leading-relaxed text-muted">
        Tus datos se guardan solo en este dispositivo. No hay servidores ni cuentas: nadie más puede verlos. La cotización
        se lee del sitio del BROU tres veces por día hábil y se publica junto a la app.
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

function PanelRow({
  icon: Icon,
  label,
  hint,
  panel,
  warn,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  panel: Panel;
  warn?: boolean;
}) {
  const setPanel = useUI((s) => s.setPanel);
  return (
    <button type="button" onClick={() => setPanel(panel)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-raised">
      <Icon size={18} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
      <span className="flex-1 text-[15px]">{label}</span>
      <span className={cx('tabular max-w-[45%] truncate text-[12px]', warn ? 'text-warn' : 'text-muted')}>{hint}</span>
      <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
    </button>
  );
}

function CurrencyRow({ label, value, onChange }: { label: string; value: Currency; onChange: (c: Currency) => void }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-1">
      <span className="text-[15px]">{label}</span>
      <Segmented ariaLabel={label} size="sm" options={CURRENCY_OPTIONS} value={value} onChange={onChange} className="shrink-0" />
    </div>
  );
}

function DataSection() {
  const demo = useLiveQuery(hasDemoData, [], undefined);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0);
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
    <Group title="Datos">
      <button
        type="button"
        disabled={busy || demo === undefined}
        onClick={() => (demo ? setConfirmDemo(true) : void load())}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-raised disabled:opacity-50"
      >
        <FlaskConical size={18} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px]">{demo ? 'Borrar datos demo' : busy ? 'Cargando…' : 'Cargar datos demo'}</span>
          <span className="block text-[12px] text-muted">Seis meses inventados para ver la app llena. No tocan tus datos.</span>
        </span>
      </button>
      <button type="button" onClick={() => setWipeStep(1)} className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-raised">
        <Trash2 size={18} strokeWidth={1.5} className="shrink-0 text-alert" aria-hidden="true" />
        <span className="flex-1 text-[15px] text-alert">Borrar todos los datos</span>
      </button>

      <ConfirmSheet
        open={confirmDemo}
        onClose={() => setConfirmDemo(false)}
        title="Borrar datos de ejemplo"
        message="Se borran los movimientos, categorías, recurrentes y presupuestos de ejemplo. Tus datos reales no se tocan."
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          const r = await clearDemoData();
          toast(`Se borraron ${r.transactions} movimientos de ejemplo`);
        }}
      />
      <ConfirmSheet
        open={wipeStep === 1}
        onClose={() => setWipeStep((s) => (s === 1 ? 0 : s))}
        title="¿Borrar todos los datos?"
        message="Se borran todos tus movimientos, categorías, recurrentes, presupuestos, ajustes y el PIN de este iPhone. Si no tenés un respaldo, no hay forma de recuperarlos."
        confirmLabel="Continuar"
        destructive
        onConfirm={() => setWipeStep(2)}
      />
      <WipeFinalSheet open={wipeStep === 2} onClose={() => setWipeStep(0)} />
    </Group>
  );
}

function WipeFinalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const ok = text.trim().toUpperCase() === 'BORRAR';
  return (
    <Sheet open={open} onClose={onClose} title="Última confirmación">
      <p className="text-[15px] text-muted">
        Escribí <span className="text-fg">BORRAR</span> para eliminar todo definitivamente.
      </p>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        aria-label="Escribí BORRAR para confirmar"
        className="mt-3 min-h-12 w-full rounded-xl border border-line bg-raised px-3 text-[16px] text-fg outline-none"
      />
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-full border border-line text-[15px]">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ok}
          onClick={async () => {
            await wipeAllData();
            window.location.reload();
          }}
          className="min-h-12 flex-1 rounded-full bg-alert text-[15px] font-medium text-bg disabled:opacity-30"
        >
          Borrar todo
        </button>
      </div>
    </Sheet>
  );
}
