/**
 * IDs de áreas y grupos según el seed.
 * Si en el futuro cambian, se puede inferir desde configStore.actual.area pero
 * para vistas específicas (Prenec/Emp/PAP/SVC) es más simple usar constantes.
 */
export const AREAS = {
  PRENEC:   1,
  PREV_EMP: 2,
  PREV_PAP: 3,
  SVC:      4
};

export const GRUPOS = {
  TELEMERCADEO:  1,
  EMPRESARIALES: 2,
  PAP:           3,
  SVC_AGENTES:   4
  // FIDELIZACION: id dinámico (varía según base). Usar GRUPO_CODIGOS.FIDELIZACION.
};

/**
 * Códigos canónicos de grupos. Preferir comparar por código (estable entre bases)
 * en lugar de por id numérico.
 */
export const GRUPO_CODIGOS = {
  TELEMERCADEO:  'TELEMERCADEO',
  EMPRESARIALES: 'EMPRESARIALES',
  PAP:           'PAP',
  SVC_AGENTES:   'SVC-AGENTES',
  FIDELIZACION:  'FIDELIZACION'
};

/**
 * Helper: el usuario pertenece al grupo Fidelización (principal o extra).
 */
export function esAgenteFidelizacion(usuario) {
  if (!usuario) return false;
  if (usuario.grupo?.grupo_codigo === GRUPO_CODIGOS.FIDELIZACION) return true;
  if (Array.isArray(usuario.gruposExtra)
      && usuario.gruposExtra.some(g => g.grupo_codigo === GRUPO_CODIGOS.FIDELIZACION)) return true;
  return false;
}
