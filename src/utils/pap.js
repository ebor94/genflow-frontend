const GRUPO_PAP = 3;

/** ¿El resultado pide próxima visita? "Volver" siempre; los demás, según Administración. */
export function pideFechaPap(resultados, codigo) {
  if (codigo === 'VOLVER') return true;
  return !!(resultados || []).find((r) =>
    r.resultado_grupo_id === GRUPO_PAP && r.resultado_codigo === codigo && r.resultado_activo)?.resultado_requiere_fecha;
}
