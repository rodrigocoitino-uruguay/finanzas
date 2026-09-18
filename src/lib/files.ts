export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Guarda un archivo. En el iPhone abre la hoja de compartir ("Guardar en Archivos");
 * si no se puede, lo descarga. Tiene que llamarse directo desde un toque.
 */
export async function saveFile(filename: string, text: string, mime: string): Promise<SaveResult> {
  const file = new File([text], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // otros errores: se prueba con la descarga
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

export function readFileText(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) return Promise.reject(new Error('El archivo es demasiado grande'));
  return file.text();
}
