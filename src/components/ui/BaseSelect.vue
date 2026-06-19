<script setup>
defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  placeholder: { type: String, default: 'Seleccione...' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div>
    <label v-if="label" class="sv-label">
      {{ label }}
      <span v-if="required" class="text-danger ml-0.5">*</span>
    </label>
    <select
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', $event.target.value)"
      class="sv-input"
      :class="{
        'border-danger focus:border-danger focus:ring-danger/20': error,
        'text-text3': !modelValue
      }"
    >
      <option value="" disabled>{{ placeholder }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <p v-if="error" class="mt-1 text-xs text-danger">{{ error }}</p>
  </div>
</template>
