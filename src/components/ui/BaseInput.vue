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
  autocomplete: { type: String, default: undefined },
  uppercase: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

function onInput(e) {
  const v = props.uppercase ? e.target.value.toUpperCase() : e.target.value;
  emit('update:modelValue', v);
}
</script>

<template>
  <div>
    <label v-if="label" class="sv-label">
      {{ label }}
      <span v-if="required" class="text-danger ml-0.5">*</span>
    </label>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :inputmode="inputmode"
      :autocomplete="autocomplete"
      @input="onInput"
      class="sv-input"
      :class="[
        { 'border-danger focus:border-danger focus:ring-danger/20': error },
        { 'uppercase': uppercase }
      ]"
    />
    <p v-if="error" class="mt-1 text-xs text-danger">{{ error }}</p>
  </div>
</template>
