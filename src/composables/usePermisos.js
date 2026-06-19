/**
 * usePermisos — wrapper sobre useAuthStore para chequeos rápidos en templates.
 */
import { useAuthStore } from '@/stores/useAuthStore';

export function usePermisos() {
  const auth = useAuthStore();
  return {
    auth,
    can: (modulo, accion) => auth.hasPermiso(modulo, accion),
    isRol: (...codigos) => codigos.includes(auth.rolCodigo),
    isLevel: (nivelMax) => auth.rolNivel <= nivelMax,
    esSuperAdmin: () => auth.esSuperAdmin,
    esAdminArea:  () => auth.esAdminArea,
    esSupervisor: () => auth.esSupervisor
  };
}
