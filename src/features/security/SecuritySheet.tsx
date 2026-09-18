import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet } from '../../components/ui/Sheet';
import { Switch } from '../../components/ui/Switch';
import { checkPin, isValidPin, removePasskey, removePin, savePasskey, setPin } from '../../db/security';
import { updateSettings } from '../../db/settings';
import { cx } from '../../lib/cx';
import { isCryptoAvailable } from '../../lib/crypto';
import { isPlatformAuthAvailable, registerPasskey } from '../../lib/webauthn';
import { useSettings } from '../../store/settings';
import { toast } from '../../store/toast';
import { useUI } from '../../store/ui';
import { PinPad } from './PinPad';

const AUTO_LOCK = [
  { value: 0, label: 'Siempre al volver' },
  { value: 1, label: 'Después de 1 min' },
  { value: 5, label: 'Después de 5 min' },
  { value: 15, label: 'Después de 15 min' },
  { value: 30, label: 'Después de 30 min' },
];

type Step =
  | { kind: 'home' }
  | { kind: 'new'; purpose: 'create' | 'change' }
  | { kind: 'confirm'; purpose: 'create' | 'change'; first: string }
  | { kind: 'verify'; then: 'change' | 'remove' };

export function SecuritySheet() {
  const open = useUI((s) => s.panel === 'security');
  const setPanel = useUI((s) => s.setPanel);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (open) setKey((k) => k + 1);
  }, [open]);
  return (
    <Sheet open={open} onClose={() => setPanel(null)} title="Seguridad">
      <SecurityBody key={key} />
    </Sheet>
  );
}

function SecurityBody() {
  const settings = useSettings();
  const [step, setStep] = useState<Step>({ kind: 'home' });
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(false);
  const hasPin = Boolean(settings.pinHash);

  useEffect(() => {
    void isPlatformAuthAvailable().then(setBio);
  }, []);

  if (!isCryptoAvailable()) {
    return (
      <p className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-[14px] text-warn">
        El bloqueo con PIN necesita una conexión segura (https). Activalo desde la app publicada o instalada.
      </p>
    );
  }

  const go = (s: Step) => {
    setPinValue('');
    setError(null);
    setStep(s);
  };

  const onPin = async (v: string) => {
    setError(null);
    setPinValue(v);
    if (step.kind === 'verify' && v.length === (settings.pinLength ?? 6)) {
      setBusy(true);
      const res = await checkPin(v);
      setBusy(false);
      if (!res.ok) {
        setPinValue('');
        setError(res.waitMs ? 'Demasiados intentos. Esperá un momento.' : 'PIN incorrecto');
        return;
      }
      if (step.then === 'remove') {
        await removePin();
        toast('Se desactivó el PIN');
        go({ kind: 'home' });
      } else {
        go({ kind: 'new', purpose: 'change' });
      }
    }
    if (step.kind === 'confirm' && v.length === step.first.length) {
      if (v !== step.first) {
        setPinValue('');
        setError('No coincide. Probá de nuevo.');
        return;
      }
      setBusy(true);
      await setPin(v);
      setBusy(false);
      toast(step.purpose === 'create' ? 'PIN activado' : 'PIN cambiado');
      go({ kind: 'home' });
    }
  };

  if (step.kind !== 'home') {
    const title =
      step.kind === 'verify'
        ? 'Ingresá tu PIN actual'
        : step.kind === 'new'
          ? 'Elegí un PIN de 4 a 6 números'
          : 'Repetí el PIN';
    const dots = step.kind === 'verify' ? (settings.pinLength ?? 6) : step.kind === 'confirm' ? step.first.length : Math.max(4, pin.length);
    return (
      <div className="flex flex-col items-center pb-2">
        <p className="text-[15px]">{title}</p>
        <p role="alert" className="mt-1 h-5 text-[13px] text-warn">
          {error}
        </p>
        <div className="mt-3">
          <PinPad label="PIN" value={pin} onChange={(v) => void onPin(v)} dots={dots} maxLength={step.kind === 'new' ? 6 : dots} disabled={busy} error={Boolean(error)} />
        </div>
        <div className="mt-6 flex w-full gap-2">
          <button type="button" onClick={() => go({ kind: 'home' })} className="min-h-12 flex-1 rounded-full border border-line text-[15px]">
            Cancelar
          </button>
          {step.kind === 'new' && (
            <button
              type="button"
              disabled={!isValidPin(pin)}
              onClick={() => go({ kind: 'confirm', purpose: step.purpose, first: pin })}
              className="min-h-12 flex-1 rounded-full bg-fg text-[15px] font-medium text-bg disabled:opacity-30"
            >
              Continuar
            </button>
          )}
        </div>
      </div>
    );
  }

  const toggleBiometrics = async (on: boolean) => {
    try {
      if (on) {
        const reg = await registerPasskey();
        await savePasskey(reg.credentialId, reg.publicKey, reg.alg);
        toast('Face ID / Touch ID activado');
      } else {
        await removePasskey();
        toast('Face ID / Touch ID desactivado');
      }
    } catch {
      toast('No se pudo activar. Probá de nuevo.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-line bg-raised p-3 text-[13px] text-muted">
        <ShieldCheck size={18} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          Es un <span className="text-fg">bloqueo de acceso a la app</span>, no un cifrado bancario: evita que alguien con tu
          iPhone desbloqueado vea tus finanzas. Los datos quedan en el teléfono, protegidos por el cifrado de iOS. El PIN
          se guarda como un código irreversible (nunca en texto).
        </p>
      </div>

      {!hasPin ? (
        <button
          type="button"
          onClick={() => go({ kind: 'new', purpose: 'create' })}
          className="min-h-12 w-full rounded-full bg-fg text-[15px] font-medium text-bg active:opacity-80"
        >
          Activar bloqueo con PIN
        </button>
      ) : (
        <>
          <div className="divide-y divide-line rounded-card border border-line px-4">
            {bio && (
              <Switch
                checked={Boolean(settings.webauthnCredentialId)}
                onChange={(on) => void toggleBiometrics(on)}
                label="Desbloquear con Face ID o Touch ID"
                description="Más rápido. Si falla, siempre queda el PIN."
              />
            )}
            <label className="flex min-h-12 items-center justify-between gap-3 text-[15px]">
              Bloquear
              <select
                value={settings.autoLockMinutes}
                onChange={(e) => void updateSettings({ autoLockMinutes: Number(e.target.value) })}
                className="min-h-10 rounded-lg border border-line bg-raised px-3 text-[15px] text-fg"
              >
                {AUTO_LOCK.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go({ kind: 'verify', then: 'change' })}
              className="min-h-12 flex-1 rounded-full border border-line text-[15px] active:bg-raised"
            >
              Cambiar PIN
            </button>
            <button
              type="button"
              onClick={() => go({ kind: 'verify', then: 'remove' })}
              className={cx('min-h-12 flex-1 rounded-full border border-line text-[15px] text-alert active:bg-raised')}
            >
              Desactivar
            </button>
          </div>
        </>
      )}
      <p className="text-[12px] text-muted">
        Si olvidás el PIN, la única salida es borrar los datos del iPhone y restaurar un respaldo. Hacé respaldos seguido.
      </p>
    </div>
  );
}
