/**
 * useNit — utilidades cliente para NIT colombiano.
 */
export function useNit() {
  function parse(raw) {
    if (raw == null) return { norm: '', dv: null };
    const limpio = String(raw).trim().replace(/[\s.()]+/g, '');
    if (limpio.includes('-')) {
      const [cuerpo, dv] = limpio.split('-');
      return { norm: cuerpo.replace(/\D/g, ''), dv: (dv || '').replace(/\D/g, '').slice(0, 1) || null };
    }
    return { norm: limpio.replace(/\D/g, ''), dv: null };
  }

  function esValido(raw) {
    const n = parse(raw).norm;
    return n.length >= 7 && n.length <= 15;
  }

  function formato(raw) {
    const { norm, dv } = parse(raw);
    if (!norm) return '';
    // Agrega puntos cada 3 dígitos desde la derecha
    const conPuntos = norm.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return dv ? `${conPuntos}-${dv}` : conPuntos;
  }

  return { parse, esValido, formato };
}
