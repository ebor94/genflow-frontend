import { computed } from 'vue'

export function useAgeCalculator(fechaRef) {
  const edad = computed(() => {
    const fecha = typeof fechaRef === 'function' ? fechaRef() : fechaRef.value
    if (!fecha) return 0
    const today = new Date()
    const birth = new Date(fecha + 'T00:00:00')
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return Math.max(0, age)
  })

  return { edad }
}
