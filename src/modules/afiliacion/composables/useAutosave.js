import { watch } from 'vue'
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'

/**
 * Composable de auto-guardado de borrador.
 * Observa cambios en afiliado, beneficiarios y seguros,
 * y llama a store.guardarBorrador() con debounce de 3 s.
 * No actúa si el modo es 'veolia'.
 */
export function useAutosave() {
  const store = useAfiliadoStore()
  let timer = null

  function scheduleGuardado() {
    if (store.formMode === 'veolia') return
    clearTimeout(timer)
    timer = setTimeout(() => { store.guardarBorrador() }, 3000)
  }

  watch(
    [
      () => ({ ...store.afiliado }),
      () => store.beneficiarios,
      () => store.seguros
    ],
    scheduleGuardado,
    { deep: true }
  )
}
