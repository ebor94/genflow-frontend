import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import './assets/styles/main.css';

// Aplicar tema persistido (claro/oscuro) antes del mount para evitar flash
if (localStorage.getItem('sv_tema') === 'dark') {
  document.documentElement.classList.add('dark');
}

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
