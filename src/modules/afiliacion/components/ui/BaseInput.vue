<script setup>
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  inputmode: { type: String, default: undefined },
  uppercase: { type: Boolean, default: false }   // ← nueva prop
})

const emit = defineEmits(['update:modelValue'])

function onInput(e) {
  const val = props.uppercase ? e.target.value.toUpperCase() : e.target.value
  emit('update:modelValue', val)
}
</script>

<template>
  <div>
    <label v-if="label" class="block text-sm font-semibold text-gray-700 mb-1">
      {{ label }}
      <span v-if="required" class="text-red-500 ml-0.5">*</span>
    </label>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :inputmode="inputmode"
      @input="onInput"
      class="block w-full rounded-lg border-gray-300 shadow-sm text-sm transition-colors duration-150
             focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
             disabled:bg-gray-100 disabled:text-gray-500
             read-only:bg-gray-50 read-only:text-gray-600"
      :class="[
        { 'border-red-400 focus:border-red-500 focus:ring-red-500/20': error },
        { 'uppercase': uppercase }
      ]"
    />
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
  </div>
</template>