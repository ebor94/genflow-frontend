<script setup>
defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'primary' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

// Tokens corporativos del CRM (tailwind.config.js): gold = primary #00875c, etc.
const variants = {
  primary: 'bg-gold text-white hover:bg-gold-bright focus:ring-gold disabled:bg-gold/40',
  secondary: 'bg-cream border border-text3/30 text-text1 hover:bg-text3/10 focus:ring-text3',
  danger: 'bg-danger text-white hover:bg-danger/90 focus:ring-danger disabled:bg-danger/40',
  success: 'bg-sage text-white hover:bg-sage/90 focus:ring-sage disabled:bg-sage/40',
  warning: 'bg-warning text-white hover:bg-warning/90 focus:ring-warning disabled:bg-warning/40'
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg
           shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2
           disabled:cursor-not-allowed"
    :class="variants[variant]"
  >
    <svg v-if="loading" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    <slot />
  </button>
</template>
