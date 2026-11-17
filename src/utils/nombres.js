/**
 * Separa el displayName del directorio activo en nombre y apellido.
 * Con 4 o más palabras asume dos nombres; si no, solo la primera es nombre.
 */
export function separarNombre(completo) {
  const partes = String(completo || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombre: partes[0] || '', apellido: '' };
  const cuantos = partes.length >= 4 ? 2 : 1;
  return { nombre: partes.slice(0, cuantos).join(' '), apellido: partes.slice(cuantos).join(' ') };
}
