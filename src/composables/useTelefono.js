/**
 * useTelefono — normalización y formateo de teléfonos colombianos en el cliente.
 */
export function useTelefono() {
  function normalizar(raw) {
    if (raw == null) return '';
    let s = String(raw).trim().replace(/[\s\-().]+/g, '');
    if (s.startsWith('+')) {
      if (s.startsWith('+57') && s.length >= 13) return s.slice(3);
      return s;
    }
    if (s.startsWith('0057')) return s.slice(4);
    if (/^57\d{10}$/.test(s)) return s.slice(2);
    return s.replace(/\D/g, '');
  }

  function esValido(raw) {
    const n = normalizar(raw);
    const d = n.replace(/^\+/, '');
    return d.length >= 7 && d.length <= 15;
  }

  function formato(raw) {
    const n = normalizar(raw);
    // Móvil 10 dígitos: 311 555 0001
    if (/^3\d{9}$/.test(n)) return `${n.slice(0,3)} ${n.slice(3,6)} ${n.slice(6)}`;
    // Fijo 7 dígitos: 607 1234
    if (/^\d{7}$/.test(n))  return `${n.slice(0,3)} ${n.slice(3)}`;
    return n;
  }

  function linkTel(raw) {
    const n = normalizar(raw);
    if (!n) return '#';
    // Colombia mobile → prefijo +57
    if (/^3\d{9}$/.test(n)) return `tel:+57${n}`;
    return `tel:${n.startsWith('+') ? n : '+' + n}`;
  }

  return { normalizar, esValido, formato, linkTel };
}
