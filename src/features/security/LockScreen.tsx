import { Lock, ScanFace } from 'lucide-react';
import { useEffect, useState } from 'react';
import { wipeAllData } from '../../db/backup';
import { checkPin, currentWaitMs } from '../../db/security';
import { isPlatformAuthAvailable, verifyPasskey } from '../../lib/webauthn';
import { useLock } from '../../store/lock';
import { useSettings } from '../../store/settings';
import { PinPad } from './PinPad';

function formatWait(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`;
}

export function LockScreen() {
  const settings = useSettings();
  const unlock = useLock((s) => s.unlock);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [waitMs, setWaitMs] = useState(0);
  const [checking, setChecking] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [forgot, setForgot] = useState(false);
  const length = settings.pinLength ?? 6;
  const hasPasskey = Boolean(settings.webauthnCredentialId);

  useEffect(() => {
    void currentWaitMs().then(setWaitMs);
    if (hasPasskey) void isPlatformAuthAvailable().then(setBioAvailable);
  }, [hasPasskey]);

  useEffect(() => {
    if (waitMs <= 0) return;
    const t = window.setInterval(() => setWaitMs((w) => Math.max(0, w - 1000)), 1000);
    return () => window.clearInterval(t);
  }, [waitMs > 0]);

  const submit = async (value: string) => {
    setChecking(true);
    try {
      const res = await checkPin(value);
      if (res.ok) {
        unlock();
        return;
      }
      setPin('');
      setShake((n) => n + 1);
      setWaitMs(res.waitMs);
      setError(res.waitMs ? `Demasiados intentos. Esperá ${formatWait(res.waitMs)}.` : 'PIN incorrecto');
    } finally {
      setChecking(false);
    }
  };

  const onChange = (v: string) => {
    setError(null);
    setPin(v);
    if (v.length === length) void submit(v);
  };

  const unlockWithBiometrics = async () => {
    if (!settings.webauthnCredentialId) return;
    setError(null);
    try {
      const ok = await verifyPasskey({
        credentialId: settings.webauthnCredentialId,
        publicKey: settings.webauthnPublicKey,
        alg: settings.webauthnAlg,
      });
      if (ok) unlock();
      else setError('No se pudo verificar. Usá el PIN.');
    } catch {
      setError('Face ID cancelado. Usá el PIN.');
    }
  };

  const locked = waitMs > 0;

  return (
    <div
      className="flex h-full flex-col items-center justify-between px-6"
      style={{ paddingTop: 'calc(var(--safe-top) + 48px)', paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}
    >
      <div className="flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-surface text-muted">
          <Lock size={24} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-[24px] font-bold tracking-tight">Finanzas</h1>
        <p className="mt-1 text-[15px] text-muted">{locked ? `Esperá ${formatWait(waitMs)}` : 'Ingresá tu PIN'}</p>
        <p role="alert" className="mt-2 h-5 text-[13px] text-warn">
          {!locked && error}
        </p>
      </div>

      <div key={shake}>
        <PinPad
          label="PIN"
          value={pin}
          onChange={onChange}
          dots={length}
          maxLength={length}
          disabled={checking || locked}
          error={shake > 0}
          extraKey={
            hasPasskey && bioAvailable ? (
              <button
                type="button"
                onClick={() => void unlockWithBiometrics()}
                aria-label="Desbloquear con Face ID o Touch ID"
                className="grid size-[72px] place-items-center rounded-full text-expense active:bg-line"
              >
                <ScanFace size={30} strokeWidth={1.5} />
              </button>
            ) : null
          }
        />
      </div>

      {forgot ? (
        <ForgotPin onCancel={() => setForgot(false)} />
      ) : (
        <button type="button" onClick={() => setForgot(true)} className="min-h-11 text-[14px] text-muted">
          ¿Olvidaste el PIN?
        </button>
      )}
    </div>
  );
}

function ForgotPin({ onCancel }: { onCancel: () => void }) {
  const [text, setText] = useState('');
  const ok = text.trim().toUpperCase() === 'BORRAR';
  return (
    <div className="w-full max-w-sm rounded-card border border-line bg-surface p-4 text-[13px]">
      <p>
        El PIN no se puede recuperar: no se guarda en ningún lado. La única salida es <strong>borrar todos los datos</strong> de
        este iPhone y después importar tu último respaldo.
      </p>
      <label className="mt-3 block text-muted">
        Para confirmar, escribí BORRAR
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-raised px-3 text-[16px] text-fg outline-none"
        />
      </label>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancel} className="min-h-11 flex-1 rounded-full border border-line">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!ok}
          onClick={async () => {
            await wipeAllData();
            window.location.reload();
          }}
          className="min-h-11 flex-1 rounded-full bg-alert font-medium text-bg disabled:opacity-30"
        >
          Borrar todo
        </button>
      </div>
    </div>
  );
}
