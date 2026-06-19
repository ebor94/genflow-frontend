import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToastStore = defineStore('toast', () => {
  const toasts = ref([]);
  let nextId = 0;

  function addToast(message, type = 'info', duration = 4000) {
    const id = nextId++;
    toasts.value.push({ id, message, type });
    setTimeout(() => removeToast(id), duration);
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  return {
    toasts,
    success: (m) => addToast(m, 'success'),
    error:   (m) => addToast(m, 'error', 6000),
    warning: (m) => addToast(m, 'warning'),
    info:    (m) => addToast(m, 'info'),
    removeToast
  };
});
