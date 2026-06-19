/**
 * abrirProspecto — helper que enruta a la ficha correcta según el área del prospecto.
 * Empresariales (B2B) → emp-ficha con empresa_id
 * Prenecesidad / PAP → prenec-ficha con prosp_id (PAP usa la misma ficha por ahora)
 * SVC → futuro caso (Fase 4)
 *
 * Códigos de área hardcoded para evitar lookup; coinciden con el seed.
 */
export function abrirProspecto(router, prospecto) {
  if (!prospecto) return;

  // Si tiene empresa, es B2B
  if (prospecto.prosp_empresa_id) {
    return router.push({ name: 'emp-ficha', params: { id: prospecto.prosp_empresa_id } });
  }

  // Por código de área
  const codigo = prospecto.area?.area_codigo;
  if (codigo === 'PREV-EMP' && prospecto.empresa?.empresa_id) {
    return router.push({ name: 'emp-ficha', params: { id: prospecto.empresa.empresa_id } });
  }
  if (codigo === 'SVC') {
    return router.push({ name: 'placeholder-svc' });   // Fase 4
  }
  if (codigo === 'PREV-PAP') {
    return router.push({ name: 'placeholder-pap' });   // Fase 3
  }

  // Default: Prenecesidad (también vale para prospectos sin codigo definido)
  return router.push({ name: 'prenec-ficha', params: { id: prospecto.prosp_id } });
}
