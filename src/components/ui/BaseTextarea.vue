<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  rows: { type: Number, default: 3 },
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
    <textarea
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      @input="$emit('update:modelValue', $event.target.value)"
      class="sv-input resize-y"
      :class="{ 'border-danger focus:border-danger focus:ring-danger/20': error }"
    />
    <p v-if="error" class="mt-1 text-xs text-danger">{{ error }}</p>
  </div>
</template>
