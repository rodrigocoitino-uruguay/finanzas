import { useLiveQuery } from 'dexie-react-hooks';
import { CircleCheck, Download, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import {
  importBackup,
  markBackupDone,
  MIN_PASSWORD_LENGTH,
  PasswordRequiredError,
  prepareBackup,
  prepareCsv,
  readBackup,
  type ImportMode,
  type PreparedFile,
  type ReadBackup,
} from '../../db/backup';
import { BackupError, MAX_BACKUP_BYTES } from '../../domain/backup';
import { cx } from '../../lib/cx';
import { isCryptoAvailable, WrongPasswordError } from '../../lib/crypto';
import { formatDate } from '../../lib/dates';
import { readFileText, saveFile } from '../../lib/files';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { useUI } from '../../store/ui';

export function BackupSheet() {
  const open = useUI((s) => s.panel === 'backup');
  const setPanel = useUI((s) => s.setPanel);
  return (
    <Sheet open={open} onClose={() => setPanel(null)} title="Respaldo">
      <div className="space-y-7">
        <ExportSection />
        <CsvSection />
        <ImportSection />
        <StorageNote />
      </div>
    </Sheet>
  );
}

const inputClass =
  'mt-1 min-h-12 w-full rounded-xl border border-line bg-raised px-3 text-[16px] text-fg outline-none focus:border-muted';

function ExportSection() {
  const settings = useSettings();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<(PreparedFile & { counts: { transactions: number } }) | null>(null);
  const valid = password.length >= MIN_PASSWORD_LENGTH && password === repeat;

  if (!isCryptoAvailable()) {
    return <p className="text-[14px] text-warn">El respaldo cifrado necesita una conexión segura (https).</p>;
  }

  const prepare = async () => {
    setBusy(true);
    try {
      setReady(await prepareBackup(password));
      setPassword('');
      setRepeat('');
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'No se pudo preparar el respaldo');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!ready) return;
    const r = await saveFile(ready.filename, ready.text, ready.mime);
    if (r === 'cancelled') return;
    await markBackupDone();
    toast('Respaldo guardado');
    setReady(null);
  };

  return (
    <section aria-labelledby="backup-title">
      <h3 id="backup-title" className="text-[15px] font-medium">
        Respaldo completo
      </h3>
      <p className="mt-1 text-[13px] text-muted">
        Todos tus movimientos, categorías, recurrentes y presupuestos en un archivo <span className="text-fg">cifrado</span> con
        una contraseña. Guardalo en Archivos o en iCloud Drive.
        {settings.lastBackupAt
          ? ` Último respaldo: ${formatDate(settings.lastBackupAt.slice(0, 10), "d 'de' MMMM")}.`
          : ' Todavía no hiciste ninguno.'}
      </p>

      {ready ? (
        <div className="mt-3 rounded-xl border border-income/30 bg-income/10 p-3">
          <p className="flex items-center gap-2 text-[14px] text-income">
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
            Respaldo listo · {ready.counts.transactions} movimientos
          </p>
          <p className="mt-1 text-[12px] text-muted">En el iPhone elegí «Guardar en Archivos».</p>
          <button
            type="button"
            onClick={() => void save()}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-fg text-[15px] font-medium text-bg active:opacity-80"
          >
            <Download size={17} strokeWidth={1.75} aria-hidden="true" />
            Guardar archivo
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block text-[12px] text-muted">
            Contraseña del respaldo (mínimo {MIN_PASSWORD_LENGTH} caracteres)
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-[12px] text-muted">
            Repetila
            <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={inputClass} />
          </label>
          {repeat.length > 0 && password !== repeat && <p className="text-[12px] text-warn">Las contraseñas no coinciden.</p>}
          <p className="flex items-start gap-2 text-[12px] text-muted">
            <TriangleAlert size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            Si la olvidás, el respaldo no se puede abrir. Guardala en tu gestor de contraseñas.
          </p>
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => void prepare()}
            className="min-h-12 w-full rounded-full bg-fg text-[15px] font-medium text-bg transition-opacity active:opacity-80 disabled:opacity-30"
          >
            {busy ? 'Cifrando…' : 'Preparar respaldo'}
          </button>
        </div>
      )}
    </section>
  );
}

function CsvSection() {
  const exportCsv = async () => {
    const f = await prepareCsv();
    const r = await saveFile(f.filename, f.text, f.mime);
    if (r !== 'cancelled') toast('CSV exportado');
  };
  return (
    <section aria-labelledby="csv-title">
      <h3 id="csv-title" className="text-[15px] font-medium">
        Movimientos en CSV
      </h3>
      <p className="mt-1 text-[13px] text-muted">
        Para abrir en Excel o Google Sheets (separador «;», decimales con coma). <span className="text-warn">No está cifrado</span>:
        guardalo en un lugar seguro.
      </p>
      <button
        type="button"
        onClick={() => void exportCsv()}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line text-[15px] active:bg-raised"
      >
        <FileSpreadsheet size={17} strokeWidth={1.5} aria-hidden="true" />
        Exportar CSV
      </button>
    </section>
  );
}

function ImportSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [data, setData] = useState<ReadBackup | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setText(null);
    setNeedsPassword(false);
    setPassword('');
    setData(null);
    setConfirmReplace(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const open = async (content: string, pwd?: string) => {
    setBusy(true);
    setError(null);
    try {
      setData(await readBackup(content, pwd));
      setNeedsPassword(false);
    } catch (e) {
      if (e instanceof PasswordRequiredError) setNeedsPassword(true);
      else if (e instanceof WrongPasswordError) setError('Contraseña incorrecta.');
      else setError(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    reset();
    try {
      const content = await readFileText(file, MAX_BACKUP_BYTES);
      setText(content);
      await open(content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    }
  };

  const doImport = async (mode: ImportMode) => {
    if (!data) return;
    setBusy(true);
    try {
      const stats = await importBackup(data.payload, mode);
      toast(
        mode === 'replace'
          ? `Listo: se restauraron ${data.payload.transactions.length} movimientos`
          : `Listo: ${stats.added} movimientos nuevos${stats.updated ? `, ${stats.updated} actualizados` : ''}`,
      );
      reset();
    } catch {
      setError('No se pudo importar. Tus datos no se tocaron.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="import-title">
      <h3 id="import-title" className="text-[15px] font-medium">
        Importar un respaldo
      </h3>
      <p className="mt-1 text-[13px] text-muted">Se revisa el archivo antes de tocar nada. Podés combinarlo o reemplazar todo.</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        id="backup-file"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {!text && (
        <label
          htmlFor="backup-file"
          className="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-line text-[15px] active:bg-raised"
        >
          <Upload size={17} strokeWidth={1.5} aria-hidden="true" />
          Elegir archivo
        </label>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-warn">
          {error}
        </p>
      )}

      {text && needsPassword && !data && (
        <div className="mt-3 space-y-2">
          <label className="block text-[12px] text-muted">
            Contraseña del respaldo
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void open(text, password)}
              className={inputClass}
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="min-h-12 flex-1 rounded-full border border-line text-[15px]">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!password || busy}
              onClick={() => void open(text, password)}
              className="min-h-12 flex-1 rounded-full bg-fg text-[15px] font-medium text-bg disabled:opacity-30"
            >
              {busy ? 'Abriendo…' : 'Abrir'}
            </button>
          </div>
        </div>
      )}

      {data && (
        <div className="mt-3 space-y-3 rounded-xl border border-line bg-raised p-3">
          <p className="text-[14px]">
            Respaldo del {data.file.exportedAt ? formatDate(data.file.exportedAt.slice(0, 10), "d 'de' MMMM yyyy") : '—'} ·{' '}
            {data.payload.transactions.length} movimientos · {data.payload.categories.length} categorías
          </p>
          {confirmReplace ? (
            <>
              <p className="text-[13px] text-warn">
                Se borran tus datos actuales y quedan exactamente los del respaldo. Tu PIN y Face ID se mantienen.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmReplace(false)} className="min-h-12 flex-1 rounded-full border border-line text-[15px]">
                  Volver
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void doImport('replace')}
                  className="min-h-12 flex-1 rounded-full bg-alert text-[15px] font-medium text-bg disabled:opacity-50"
                >
                  Reemplazar todo
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmReplace(true)}
                className="min-h-12 flex-1 rounded-full border border-line text-[14px] active:bg-line"
              >
                Reemplazar todo
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void doImport('merge')}
                className={cx('min-h-12 flex-1 rounded-full bg-fg text-[14px] font-medium text-bg active:opacity-80 disabled:opacity-50')}
              >
                Combinar
              </button>
            </div>
          )}
          <button type="button" onClick={reset} className="min-h-9 text-[13px] text-muted">
            Cancelar
          </button>
        </div>
      )}
    </section>
  );
}

function StorageNote() {
  const persisted = useLiveQuery(async () => {
    try {
      return (await navigator.storage?.persisted?.()) ?? false;
    } catch {
      return false;
    }
  }, []);
  return (
    <p className="text-[12px] leading-relaxed text-muted">
      Tus datos viven solo en este iPhone: si borrás la app, se pierden. Por eso conviene un respaldo al menos una vez por
      mes.{' '}
      {persisted ? 'El almacenamiento está marcado como persistente.' : 'Instalá la app en la pantalla de inicio para que iOS no borre los datos.'}
    </p>
  );
}
