<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  options:    { type: Array, required: true } // [{ value, label, icon?, count? }]
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="opt in options" :key="opt.value"
      @click="$emit('update:modelValue', opt.value)"
      class="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
      :class="modelValue === opt.value
        ? 'bg-gold text-white border-gold'
        : 'bg-white text-text2 border-text3/30 hover:bg-cream'"
    >
      <span v-if="opt.icon" class="mr-1" aria-hidden="true">{{ opt.icon }}</span>
      {{ opt.label }}
      <span v-if="opt.count != null" class="ml-1 opacity-70">({{ opt.count }})</span>
    </button>
  </div>
</template>
