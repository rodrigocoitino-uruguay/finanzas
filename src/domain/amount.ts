/**
 * Entrada de montos con formato uruguayo: "." separa miles y "," decimales.
 * El campo guarda un texto canónico ("28000,5") y muestra "28.000,5".
 */

const MAX_INT_DIGITS = 12;

/** Convierte texto escrito por el usuario a número. null si no es válido. */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[\s $]|US/g, '');
  if (s === '') return null;
  if (s.includes(',')) {
    // es-UY: los puntos son separadores de miles
    s = s.replace(/\./g, '').replace(',', '.');
    if (s.includes(',')) return null;
  } else {
    const dots = (s.match(/\./g) ?? []).length;
    if (dots > 1) {
      s = s.replace(/\./g, '');
    } else if (dots === 1) {
      // "1.890" es mil ochocientos noventa; "1.5" es uno coma cinco
      const [int, dec] = s.split('.');
      if (dec.length === 3 && int !== '' && int !== '0') s = s.replace('.', '');
    }
  }
  if (!/^\d*(\.\d*)?$/.test(s) || s === '.' ) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Texto canónico ("28000,5") → texto visible ("28.000,5"). */
export function displayAmount(canonical: string): string {
  if (canonical === '') return '';
  const [int, dec] = canonical.split(',');
  const grouped = groupThousands(int === '' ? '0' : int);
  return dec === undefined ? grouped : `${grouped},${dec}`;
}

/**
 * Recibe lo que quedó en el input después de teclear (con los puntos de miles
 * que pusimos nosotros) y devuelve el texto canónico.
 * Un "." tecleado al final (teclado en inglés) se interpreta como coma decimal.
 */
export function sanitizeAmountInput(raw: string, previousDisplay: string): string {
  let s = raw.replace(/[^\d.,]/g, '');
  const typedDotAtEnd =
    s.endsWith('.') && s.length === previousDisplay.length + 1 && !previousDisplay.includes(',');
  if (typedDotAtEnd) s = `${s.slice(0, -1)},`;
  s = s.replace(/\./g, '');

  const firstComma = s.indexOf(',');
  let int = firstComma === -1 ? s : s.slice(0, firstComma);
  let dec = firstComma === -1 ? undefined : s.slice(firstComma + 1).replace(/,/g, '');

  int = int.replace(/^0+(?=\d)/, '').slice(0, MAX_INT_DIGITS);
  if (dec !== undefined) {
    dec = dec.slice(0, 2);
    if (int === '') int = '0';
  }
  return dec === undefined ? int : `${int},${dec}`;
}

/** Número → texto canónico para editar un monto existente. */
export function amountToCanonical(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '';
  const [int, dec] = n.toFixed(2).split('.');
  return dec === '00' ? int : `${int},${dec.replace(/0$/, '')}`;
}

export function canonicalToNumber(canonical: string): number | null {
  if (canonical === '') return null;
  return parseAmount(canonical);
}
