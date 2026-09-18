import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    const storage = /indexeddb|database|quota/i.test(`${this.state.error.name} ${this.state.error.message}`);
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <p className="font-display text-[24px] font-bold tracking-tight">Algo salió mal</p>
        <p className="text-[15px] text-muted">
          {storage
            ? 'No se pudo abrir el almacenamiento local. Si estás en navegación privada, abrí la app en una ventana normal.'
            : 'Tus datos siguen guardados en este dispositivo. Probá recargar la app.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 rounded-full bg-fg px-6 font-medium text-bg"
        >
          Recargar
        </button>
      </div>
    );
  }
}
