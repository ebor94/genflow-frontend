# SP-1b · Eventos multi-asesor + pool público — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** UI Vue del CRM para que los jefes creen y gestionen eventos multi-asesor (rango de fechas o slots, con apoyo opcional, con link público de registro), y una landing pública para que personas externas se registren al pool.

**Architecture:** Extensión de `eventosAgendaApi` + 5 componentes nuevos + rediseño del modal existente + 1 vista pública standalone + 2 rutas nuevas. Vitest para componentes con lógica de negocio (modal, panel de pool). Otros se validan en smoke UI en Task 8. Layout público se activa vía `meta: { publica: true }` (ya soportado por `App.vue::hideShell`).

**Tech Stack:** Vue 3 + Pinia + Vite + Tailwind · Vitest + @vue/test-utils + @pinia/testing (todo instalado en SP-4).

**Fuera de scope:** OTP de edición (SP-3). Vistas de seguimiento tipo Gantt (SP-2).

## Global Constraints

- Rutas nuevas en `src/router/index.js`: usar `meta: { publica: true }` para la landing pública (matches convención existente; `App.vue::hideShell` esconde sidebar/header cuando esto está true).
- Extender el objeto `eventosAgendaApi` ya existente en `src/api/agendaApi.js` — NO crear archivo separado.
- Componentes UI usan Tailwind con el patrón del codebase (mismos colores que `NuevoEventoAgendaModal.vue` actual): `bg-white`, `text-text1/2/3`, `border-gray-200`, botones `bg-primary hover:bg-primary/90` cuando sean acciones primarias.
- Modales usan `<Teleport to="body">` (patrón establecido en `BaseModal.vue`, `RegistroRapidoModal.vue`, `CallScreen.vue`) + `stubs: { teleport: true }` en tests vitest.
- Los assertions con `wrapper.text()` u `wrapper.find()` sobre teleported content sólo funcionan con `stubs: { teleport: true }` — patrón ya establecido en SP-4 Task 7.
- Pinia store con Composition API + `export const useX = defineStore(...)`.
- Attribution: cada subagente firma con su propio modelo (política SDD establecida). NO forzar "Claude Opus 4.7".
- Fechas siempre `America/Bogota` para display (`toLocaleString('es-CO', {timeZone:'America/Bogota'})`).
- Base URL del CRM en producción: `https://losolivoscucuta.com/genflow/`; la ruta pública `/registro-evento/:hash` queda en `https://losolivoscucuta.com/genflow/registro-evento/:hash`.

---

## File Structure

Todos los paths bajo `crm-frontend/`.

**Nuevo:**
- `src/views/comun/EventoDetalleView.vue` — contenedor con 3 tabs
- `src/components/eventos/EventoAsistentesPanel.vue` — tab 1: lista + edit métricas
- `src/components/eventos/EventoPoolPanel.vue` — tab 2: tabla + asignar
- `src/components/eventos/EventoLinkPublicoShare.vue` — botón/dropdown para copiar link
- `src/views/public/RegistroPublicoEventoView.vue` — landing pública standalone
- `src/components/eventos/__tests__/EventoPoolPanel.spec.js` — tests de asignar
- `src/components/crm/__tests__/NuevoEventoAgendaModal.spec.js` — tests del modal rediseñado

**Modificado:**
- `src/api/agendaApi.js` — extender `eventosAgendaApi` + agregar `publicEventosApi`
- `src/components/crm/NuevoEventoAgendaModal.vue` — rediseño (modo_fechas + asistentes multi + apoyo + link público + meta_leads)
- `src/router/index.js` — 2 rutas nuevas (`/eventos/:id`, `/registro-evento/:hash`)
- `src/composables/useAgenda.js` — helper para listar asesores del scope (si aún no existe)

---

## Task 1: Extender `eventosAgendaApi` + `publicEventosApi`

**Files:**
- Modify: `crm-frontend/src/api/agendaApi.js`

**Interfaces:**
- Produces:
  - `eventosAgendaApi.pool(id, params={}) → Promise` (GET /:id/pool)
  - `eventosAgendaApi.asignarPool(id, poolId, {asesor_id}) → Promise` (POST /:id/pool/:pool_id/asignar)
  - `eventosAgendaApi.metricasAsistente(evaId, payload) → Promise` (PATCH /asistentes/:eva_id/metricas)
  - `eventosAgendaApi.resumen(id) → Promise` (GET /:id/resumen)
  - `publicEventosApi.landing(hash) → Promise` (GET /public/eventos/:hash)
  - `publicEventosApi.registrar(hash, payload) → Promise` (POST /public/eventos/:hash/registro)

- [ ] **Step 1: Leer archivo actual**

Run:
```bash
cd crm-frontend && cat src/api/agendaApi.js
```

- [ ] **Step 2: Reemplazar el contenido con la versión extendida**

Path: `crm-frontend/src/api/agendaApi.js`

```js
/**
 * api/agendaApi.js
 * Agenda unificada del asesor + CRUD eventos.
 * Migración 018: creación básica de eventos.
 * Migración 020 (SP-1a): multi-asesor + pool público.
 */
import api from './axios';

export const agendaApi = {
  // Listado del día (gestiones próximas + eventos)
  dia: ({ fecha, asesorId = null }) =>
    api.get('/agenda/dia', { params: { fecha, asesor_id: asesorId || undefined } }).then(r => r.data),

  // Agregado por día para colorear el calendario
  mes: ({ anio, mes, asesorId = null }) =>
    api.get('/agenda/mes', { params: { anio, mes, asesor_id: asesorId || undefined } }).then(r => r.data)
};

export const eventosAgendaApi = {
  get:              (id)                 => api.get(`/eventos-agenda/${id}`).then(r => r.data),
  create:           (data)               => api.post('/eventos-agenda', data).then(r => r.data),
  update:           (id, data)           => api.put(`/eventos-agenda/${id}`, data).then(r => r.data),
  marcarCompletado: (id, completado)     => api.patch(`/eventos-agenda/${id}/completado`, { completado }).then(r => r.data),
  remove:           (id)                 => api.delete(`/eventos-agenda/${id}`).then(r => r.data),

  // SP-1a · Pool + métricas + resumen
  pool:               (id, params = {})            => api.get(`/eventos-agenda/${id}/pool`, { params }).then(r => r.data),
  asignarPool:        (id, poolId, payload)        => api.post(`/eventos-agenda/${id}/pool/${poolId}/asignar`, payload).then(r => r.data),
  metricasAsistente:  (evaId, payload)             => api.patch(`/eventos-agenda/asistentes/${evaId}/metricas`, payload).then(r => r.data),
  resumen:            (id)                          => api.get(`/eventos-agenda/${id}/resumen`).then(r => r.data)
};

// SP-1a · Endpoints públicos (sin auth). Usan la misma instancia axios;
// los interceptors de auth deben skipear si no hay token en localStorage.
export const publicEventosApi = {
  landing:   (hash)          => api.get(`/public/eventos/${hash}`).then(r => r.data),
  registrar: (hash, payload) => api.post(`/public/eventos/${hash}/registro`, payload).then(r => r.data)
};
```

- [ ] **Step 3: Verificar sintaxis con build**

Run:
```bash
cd crm-frontend && npm run build 2>&1 | tail -6
```
Expected: `✓ built in ...` sin errores.

- [ ] **Step 4: Commit**

```bash
cd crm-frontend && git add src/api/agendaApi.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): extender eventosAgendaApi + publicEventosApi

- pool(id, params) / asignarPool(id, poolId, payload)
- metricasAsistente(evaId, payload)
- resumen(id)
- publicEventosApi (landing + registrar, sin auth)

Base del frontend SP-1b (UI eventos multi-asesor + pool público).
EOF
)"
```

Attribution: TU trailer.

---

## Task 2: Rediseñar `NuevoEventoAgendaModal.vue`

**Files:**
- Modify: `crm-frontend/src/components/crm/NuevoEventoAgendaModal.vue` (rediseño casi total)
- Create: `crm-frontend/src/components/crm/__tests__/NuevoEventoAgendaModal.spec.js`

**Interfaces:**
- Consumes: `useAuthStore` (usr_id, rol_codigo), `eventosAgendaApi.create`, `useToastStore`, dropdown de usuarios del scope (obtener via `GET /api/sv/usuarios?activo=1&limit=200` — endpoint ya existente).
- Produces: modal con formulario que hace POST /eventos-agenda con el shape nuevo. Props: `open` (boolean), `fecha-defecto` (optional ISO string). Emits: `close`, `created` (con el evento creado como payload).

- [ ] **Step 1: Leer el modal actual + registrar el shape del formulario existente**

Run:
```bash
cd crm-frontend && cat src/components/crm/NuevoEventoAgendaModal.vue
```

Anotar props, emits, y la lógica existente para preservar el patrón visual.

- [ ] **Step 2: Escribir el test del modal rediseñado**

Path: `crm-frontend/src/components/crm/__tests__/NuevoEventoAgendaModal.spec.js`

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import NuevoEventoAgendaModal from '@/components/crm/NuevoEventoAgendaModal.vue';

vi.mock('@/api/agendaApi', () => ({
  eventosAgendaApi: { create: vi.fn() }
}));
vi.mock('@/api/usuariosApi', () => ({
  usuariosApi: {
    listar: vi.fn().mockResolvedValue({
      data: [
        { usr_id: 10, usr_nombre: 'Juan', usr_apellido: 'P', rol: { rol_codigo: 'ASESOR' } },
        { usr_id: 11, usr_nombre: 'Ana',  usr_apellido: 'G', rol: { rol_codigo: 'ASESOR' } },
        { usr_id: 20, usr_nombre: 'Coordinador', usr_apellido: 'X', rol: { rol_codigo: 'COORDINADOR_PREVISION' } }
      ]
    })
  }
}));

import { eventosAgendaApi } from '@/api/agendaApi';

function factory(props = {}) {
  return mount(NuevoEventoAgendaModal, {
    props: { open: true, ...props },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
      stubs: { teleport: true }
    },
    attachTo: document.body
  });
}

beforeEach(() => { vi.clearAllMocks(); document.body.innerHTML = ''; });

describe('NuevoEventoAgendaModal', () => {
  it('renderiza título y campos base', async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.text()).toContain('Nuevo evento');
    expect(wrapper.find('[data-testid="input-titulo"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="select-tipo"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="radio-modo-UNICO"]').exists()).toBe(true);
  });

  it('modo UNICO no muestra el picker de slots ni el date-range', async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.find('[data-testid="slots-picker"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="input-fecha-fin"]').exists()).toBe(false);
  });

  it('modo DIA_COMPLETO_MULTI muestra date-range', async () => {
    const wrapper = factory();
    await flushPromises();
    await wrapper.find('[data-testid="radio-modo-DIA_COMPLETO_MULTI"]').trigger('change');
    expect(wrapper.find('[data-testid="input-fecha-fin"]').exists()).toBe(true);
  });

  it('modo SLOTS muestra slots-picker', async () => {
    const wrapper = factory();
    await flushPromises();
    await wrapper.find('[data-testid="radio-modo-SLOTS"]').trigger('change');
    expect(wrapper.find('[data-testid="slots-picker"]').exists()).toBe(true);
  });

  it('permite agregar múltiples asistentes', async () => {
    const wrapper = factory();
    await flushPromises();
    // Selecciona los 3 chips
    const chips = wrapper.findAll('[data-testid^="chip-usr-"]');
    expect(chips.length).toBeGreaterThanOrEqual(3);
  });

  it('toggle "registro público" muestra el meta_leads', async () => {
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.find('[data-testid="input-meta-leads"]').exists()).toBe(false);
    await wrapper.find('[data-testid="toggle-publico"]').setValue(true);
    expect(wrapper.find('[data-testid="input-meta-leads"]').exists()).toBe(true);
  });

  it('submit envía payload con shape correcto', async () => {
    eventosAgendaApi.create.mockResolvedValue({ data: { evento_id: 500 } });
    const wrapper = factory();
    await flushPromises();

    await wrapper.find('[data-testid="input-titulo"]').setValue('Feria QA');
    await wrapper.find('[data-testid="select-tipo"]').setValue('FERIA');
    await wrapper.find('[data-testid="input-fecha-inicio"]').setValue('2026-11-01T13:00');
    // Selecciona 2 asistentes
    await wrapper.find('[data-testid="chip-usr-10"]').trigger('click');
    await wrapper.find('[data-testid="chip-usr-11"]').trigger('click');
    await wrapper.find('[data-testid="btn-crear"]').trigger('click');
    await flushPromises();

    expect(eventosAgendaApi.create).toHaveBeenCalledWith(expect.objectContaining({
      titulo: 'Feria QA',
      tipo: 'FERIA',
      modo_fechas: 'UNICO',
      asistentes_ids: [10, 11]
    }));
  });

  it('emite created al recibir respuesta OK', async () => {
    eventosAgendaApi.create.mockResolvedValue({ data: { evento_id: 500 } });
    const wrapper = factory();
    await flushPromises();
    await wrapper.find('[data-testid="input-titulo"]').setValue('Test');
    await wrapper.find('[data-testid="input-fecha-inicio"]').setValue('2026-11-01T13:00');
    await wrapper.find('[data-testid="chip-usr-10"]').trigger('click');
    await wrapper.find('[data-testid="btn-crear"]').trigger('click');
    await flushPromises();
    const emitted = wrapper.emitted('created');
    expect(emitted).toBeTruthy();
    expect(emitted[0][0].evento_id).toBe(500);
  });
});
```

- [ ] **Step 3: RED**

Run:
```bash
cd crm-frontend && npx vitest run src/components/crm/__tests__/NuevoEventoAgendaModal.spec.js 2>&1 | tail -30
```
Expected: FAIL (los data-testid nuevos no existen en el modal actual).

- [ ] **Step 4: Rediseñar el componente**

Path: `crm-frontend/src/components/crm/NuevoEventoAgendaModal.vue`

```vue
<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div class="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <header class="bg-primary px-6 py-4 text-white flex items-center justify-between">
          <h3 class="font-bold">Nuevo evento</h3>
          <button type="button" class="text-white/80 hover:text-white" @click="cerrar">✕</button>
        </header>

        <form @submit.prevent="crear" class="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <!-- Título + tipo -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-2">
              <label class="text-xs font-medium text-text2">Título</label>
              <input v-model="form.titulo" data-testid="input-titulo" type="text" required
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-text2">Tipo</label>
              <select v-model="form.tipo" data-testid="select-tipo"
                      class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm">
                <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>

          <!-- Modo de fechas -->
          <div>
            <label class="text-xs font-medium text-text2">Modo de fechas</label>
            <div class="mt-2 flex flex-wrap gap-3 text-sm">
              <label class="inline-flex items-center gap-1">
                <input type="radio" v-model="form.modo_fechas" value="UNICO" data-testid="radio-modo-UNICO" @change="onModoChange">
                <span>Única</span>
              </label>
              <label class="inline-flex items-center gap-1">
                <input type="radio" v-model="form.modo_fechas" value="DIA_COMPLETO_MULTI" data-testid="radio-modo-DIA_COMPLETO_MULTI" @change="onModoChange">
                <span>Rango de días</span>
              </label>
              <label class="inline-flex items-center gap-1">
                <input type="radio" v-model="form.modo_fechas" value="SLOTS" data-testid="radio-modo-SLOTS" @change="onModoChange">
                <span>Slots por día</span>
              </label>
            </div>
          </div>

          <!-- Fechas -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-medium text-text2">Fecha inicio</label>
              <input v-model="form.fecha_inicio" data-testid="input-fecha-inicio" type="datetime-local" required
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div v-if="form.modo_fechas === 'DIA_COMPLETO_MULTI'">
              <label class="text-xs font-medium text-text2">Fecha fin</label>
              <input v-model="form.fecha_fin" data-testid="input-fecha-fin" type="datetime-local" required
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <!-- Slots (modo SLOTS) -->
          <div v-if="form.modo_fechas === 'SLOTS'" data-testid="slots-picker" class="border border-gray-200 rounded-lg p-3 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-text2">Slots</span>
              <button type="button" class="text-xs text-primary hover:underline" @click="agregarSlot">+ Agregar slot</button>
            </div>
            <div v-for="(s, i) in form.slots" :key="i" class="grid grid-cols-4 gap-2 text-sm">
              <input v-model="s.fecha" type="date" class="col-span-2 py-1 px-2 border border-gray-300 rounded" />
              <input v-model="s.hora_inicio" type="time" class="py-1 px-2 border border-gray-300 rounded" />
              <div class="flex gap-1">
                <input v-model="s.hora_fin" type="time" class="flex-1 py-1 px-2 border border-gray-300 rounded" />
                <button type="button" class="px-2 text-red-500" @click="quitarSlot(i)">✕</button>
              </div>
            </div>
          </div>

          <!-- Asistentes -->
          <div>
            <label class="text-xs font-medium text-text2">Asistentes</label>
            <div class="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              <button v-for="u in usuarios" :key="u.usr_id" type="button"
                      :data-testid="`chip-usr-${u.usr_id}`"
                      class="text-xs px-2 py-1 rounded-full border transition"
                      :class="isAsistente(u.usr_id)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-text2 border-gray-300 hover:border-primary'"
                      @click="toggleAsistente(u.usr_id)">
                {{ u.usr_nombre }} {{ u.usr_apellido }}
              </button>
            </div>
          </div>

          <!-- Apoyo (opcional) -->
          <div>
            <label class="text-xs font-medium text-text2">Apoyo (opcional)</label>
            <select v-model="form.apoyo_usr_id" data-testid="select-apoyo"
                    class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm">
              <option :value="null">-- Sin apoyo --</option>
              <option v-for="u in usuarios" :key="u.usr_id" :value="u.usr_id">
                {{ u.usr_nombre }} {{ u.usr_apellido }} ({{ u.rol?.rol_codigo }})
              </option>
            </select>
          </div>

          <!-- Descripción -->
          <div>
            <label class="text-xs font-medium text-text2">Descripción</label>
            <textarea v-model="form.descripcion" rows="2"
                      class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm resize-none"></textarea>
          </div>

          <!-- Toggle registro público + meta -->
          <div class="border-t pt-4 space-y-3">
            <label class="inline-flex items-center gap-2">
              <input type="checkbox" v-model="form.registros_publicos_habilitado" data-testid="toggle-publico">
              <span class="text-sm text-text1">Habilitar link público de registro</span>
            </label>
            <div v-if="form.registros_publicos_habilitado">
              <label class="text-xs font-medium text-text2">Meta de leads (opcional)</label>
              <input v-model.number="form.meta_leads" data-testid="input-meta-leads" type="number" min="0"
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        </form>

        <footer class="border-t px-6 py-3 flex justify-end gap-2">
          <button type="button" class="px-4 py-2 text-sm text-text2 hover:text-text1" @click="cerrar">Cancelar</button>
          <button type="button" data-testid="btn-crear" :disabled="!puedeCrear || cargando"
                  class="px-4 py-2 text-sm bg-primary hover:bg-primary/90 disabled:bg-gray-300 text-white rounded-lg"
                  @click="crear">
            {{ cargando ? 'Creando...' : 'Crear evento' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { eventosAgendaApi } from '@/api/agendaApi';
import { usuariosApi } from '@/api/usuariosApi';

const props = defineProps({
  open:         { type: Boolean, default: false },
  fechaDefecto: { type: String,  default: null }
});
const emit = defineEmits(['close', 'created']);

const auth  = useAuthStore();
const toast = useToastStore();

const TIPOS = ['REUNION','VISITA','CAPACITACION','LLAMADA','FERIA','PERSONAL','OTRO','SEGUIMIENTO'];

const cargando = ref(false);
const usuarios = ref([]);
const asistentesIds = ref([]);

const form = reactive({
  titulo: '',
  tipo: 'REUNION',
  modo_fechas: 'UNICO',
  fecha_inicio: '',
  fecha_fin: '',
  slots: [],
  apoyo_usr_id: null,
  descripcion: '',
  registros_publicos_habilitado: false,
  meta_leads: null
});

function reset() {
  form.titulo = '';
  form.tipo = 'REUNION';
  form.modo_fechas = 'UNICO';
  form.fecha_inicio = props.fechaDefecto ? toLocal(props.fechaDefecto) : '';
  form.fecha_fin = '';
  form.slots = [];
  form.apoyo_usr_id = null;
  form.descripcion = '';
  form.registros_publicos_habilitado = false;
  form.meta_leads = null;
  asistentesIds.value = auth.usuario?.usr_id ? [auth.usuario.usr_id] : [];
}

watch(() => props.open, (v) => { if (v) reset(); });

onMounted(async () => {
  try {
    const r = await usuariosApi.listar({ activo: 1, limit: 200 });
    usuarios.value = r.data || r;
  } catch (e) {
    toast.error('No se pudieron cargar los usuarios');
  }
  if (props.open) reset();
});

function toLocal(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function isAsistente(id) { return asistentesIds.value.includes(id); }
function toggleAsistente(id) {
  const i = asistentesIds.value.indexOf(id);
  if (i >= 0) asistentesIds.value.splice(i, 1);
  else asistentesIds.value.push(id);
}
function agregarSlot() {
  form.slots.push({ fecha: '', hora_inicio: '', hora_fin: '' });
}
function quitarSlot(i) { form.slots.splice(i, 1); }
function onModoChange() {
  if (form.modo_fechas !== 'DIA_COMPLETO_MULTI') form.fecha_fin = '';
  if (form.modo_fechas !== 'SLOTS') form.slots = [];
  else if (form.slots.length === 0) agregarSlot();
}

const puedeCrear = computed(() =>
  form.titulo.trim().length >= 2 &&
  form.fecha_inicio &&
  asistentesIds.value.length >= 1 &&
  (form.modo_fechas !== 'DIA_COMPLETO_MULTI' || form.fecha_fin) &&
  (form.modo_fechas !== 'SLOTS' || form.slots.every(s => s.fecha && s.hora_inicio && s.hora_fin))
);

async function crear() {
  if (!puedeCrear.value) return;
  cargando.value = true;
  try {
    const payload = {
      titulo:                        form.titulo.trim(),
      descripcion:                   form.descripcion || null,
      tipo:                          form.tipo,
      modo_fechas:                   form.modo_fechas,
      fecha_inicio:                  new Date(form.fecha_inicio).toISOString(),
      asistentes_ids:                [...asistentesIds.value],
      apoyo_usr_id:                  form.apoyo_usr_id || null,
      registros_publicos_habilitado: !!form.registros_publicos_habilitado,
      meta_leads:                    form.meta_leads || null
    };
    if (form.modo_fechas === 'DIA_COMPLETO_MULTI') {
      payload.fecha_fin = new Date(form.fecha_fin).toISOString();
    }
    if (form.modo_fechas === 'SLOTS') {
      payload.slots = form.slots.map(s => ({ fecha: s.fecha, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin }));
    }
    const r = await eventosAgendaApi.create(payload);
    toast.success('Evento creado');
    emit('created', r.data || r);
    emit('close');
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo crear el evento');
  } finally {
    cargando.value = false;
  }
}

function cerrar() { emit('close'); }
</script>
```

- [ ] **Step 5: GREEN**

Run:
```bash
cd crm-frontend && npx vitest run src/components/crm/__tests__/NuevoEventoAgendaModal.spec.js 2>&1 | tail -25
```
Expected: PASS 8/8.

- [ ] **Step 6: Build**

Run:
```bash
cd crm-frontend && npm run build 2>&1 | tail -8
```
Expected: `✓ built in ...` sin errores.

- [ ] **Step 7: Commit**

```bash
cd crm-frontend && git add src/components/crm/NuevoEventoAgendaModal.vue src/components/crm/__tests__/NuevoEventoAgendaModal.spec.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): rediseño NuevoEventoAgendaModal para SP-1a

Formulario rediseñado:
- modo_fechas radio (UNICO / DIA_COMPLETO_MULTI / SLOTS) con campos
  condicionales (fecha_fin visible solo en rango, slots-picker solo
  en modo SLOTS)
- asistentes multiselect (chips) con carga desde /api/sv/usuarios
- apoyo_usr_id opcional (dropdown)
- toggle registros_publicos_habilitado + meta_leads condicional
- puedeCrear valida shape mínimo antes de habilitar submit

Tests: 8/8 con stubs teleport (patrón SP-4).
EOF
)"
```

Attribution: TU trailer.

---

## Task 3: `EventoDetalleView.vue` (contenedor + 3 tabs shell)

**Files:**
- Create: `crm-frontend/src/views/comun/EventoDetalleView.vue`
- Modify: `crm-frontend/src/router/index.js` (agregar la ruta)

**Interfaces:**
- Route: `/eventos/:id` → `EventoDetalleView`. `meta: { requiereAuth: true }`.
- Consumes: `eventosAgendaApi.get(id)` para el header + `eventosAgendaApi.resumen(id)` para totales.
- Produces: view con header (título, fechas, botón "Editar", botón cerrar) + 3 tabs: Asistentes | Pool | Link público.

- [ ] **Step 1: Crear el view**

Path: `crm-frontend/src/views/comun/EventoDetalleView.vue`

```vue
<template>
  <div class="p-4 sm:p-6 max-w-5xl mx-auto">
    <div v-if="cargando" class="text-center py-10 text-text2">Cargando...</div>
    <div v-else-if="!evento" class="text-center py-10 text-red-500">Evento no encontrado</div>
    <div v-else>
      <!-- Header -->
      <header class="bg-white rounded-2xl shadow border border-gray-100 p-4 sm:p-5 mb-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="text-xs uppercase text-primary font-semibold">{{ evento.evento_tipo }}</span>
              <span v-if="evento.evento_registros_publicos_habilitado"
                    class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Público</span>
            </div>
            <h1 class="text-lg sm:text-xl font-bold text-text1 leading-tight">{{ evento.evento_titulo }}</h1>
            <p class="text-xs text-text3 mt-1">{{ fechasFmt }}</p>
          </div>
          <div class="flex gap-1 flex-shrink-0">
            <RouterLink :to="{ name: 'agenda' }" class="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50">
              Volver
            </RouterLink>
          </div>
        </div>
        <div v-if="evento.evento_descripcion" class="text-sm text-text2 mt-3">
          {{ evento.evento_descripcion }}
        </div>

        <!-- KPIs del resumen -->
        <div v-if="resumen" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 border-t pt-4">
          <div>
            <div class="text-xs text-text3">Total registros</div>
            <div class="text-lg font-bold text-text1">{{ resumen.total_registros }}</div>
          </div>
          <div>
            <div class="text-xs text-text3">Pendientes de asignar</div>
            <div class="text-lg font-bold text-primary">{{ resumen.total_pendientes }}</div>
          </div>
          <div>
            <div class="text-xs text-text3">Asignados</div>
            <div class="text-lg font-bold text-green-600">{{ resumen.total_asignados }}</div>
          </div>
          <div v-if="evento.evento_meta_leads">
            <div class="text-xs text-text3">Meta</div>
            <div class="text-lg font-bold text-text1">{{ evento.evento_meta_leads }}</div>
          </div>
        </div>
      </header>

      <!-- Tabs -->
      <div class="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        <nav class="flex border-b border-gray-200 text-sm font-medium">
          <button v-for="t in tabs" :key="t.key" type="button"
                  :class="tab === t.key
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text3 hover:text-text2'"
                  class="flex-1 py-3"
                  @click="tab = t.key">
            {{ t.label }} <span v-if="t.badge" class="ml-1 text-xs bg-gray-200 text-text2 px-1.5 py-0.5 rounded">{{ t.badge }}</span>
          </button>
        </nav>
        <div class="p-4 sm:p-5">
          <EventoAsistentesPanel v-if="tab === 'asistentes'" :evento="evento" @refresh="cargar" />
          <EventoPoolPanel        v-else-if="tab === 'pool'" :evento="evento" @asignado="cargar" />
          <EventoLinkPublicoShare v-else-if="tab === 'link'" :evento="evento" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';
import EventoAsistentesPanel  from '@/components/eventos/EventoAsistentesPanel.vue';
import EventoPoolPanel        from '@/components/eventos/EventoPoolPanel.vue';
import EventoLinkPublicoShare from '@/components/eventos/EventoLinkPublicoShare.vue';

const route  = useRoute();
const toast  = useToastStore();
const cargando = ref(true);
const evento   = ref(null);
const resumen  = ref(null);
const tab      = ref('asistentes');

const tabs = computed(() => [
  { key: 'asistentes', label: 'Asistentes', badge: evento.value?.asistentes?.length || 0 },
  { key: 'pool',       label: 'Pool',       badge: resumen.value?.total_pendientes || 0 },
  { key: 'link',       label: 'Link público' }
]);

const fechasFmt = computed(() => {
  if (!evento.value) return '';
  const fmt = (d) => new Date(d).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short'
  });
  const inicio = fmt(evento.value.evento_fecha_hora);
  const fin = evento.value.evento_fecha_fin ? ' → ' + fmt(evento.value.evento_fecha_fin) : '';
  return inicio + fin;
});

async function cargar() {
  cargando.value = true;
  try {
    const eid = parseInt(route.params.id);
    const [ev, res] = await Promise.all([
      eventosAgendaApi.get(eid),
      eventosAgendaApi.resumen(eid).catch(() => null)
    ]);
    evento.value  = ev.data || ev;
    resumen.value = res?.data || res || null;
  } catch (e) {
    toast.error('No se pudo cargar el evento');
    evento.value = null;
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>
```

- [ ] **Step 2: Agregar la ruta en el router**

Editar `crm-frontend/src/router/index.js`. Buscar la sección `// ─── Agenda transversal (Migración 018) ───` y agregar debajo:

```js
  // SP-1b · Eventos multi-asesor
  { path: '/eventos/:id', name: 'evento-detalle',
    component: () => import('@/views/comun/EventoDetalleView.vue'),
    meta: { requiereAuth: true } },
```

- [ ] **Step 3: Build**

Run:
```bash
cd crm-frontend && npm run build 2>&1 | tail -8
```
Expected: `✓ built in ...`. (Los 3 imports de tabs referencian archivos que aún no existen — Vite tolera con lazy imports, pero puede fallar. Si falla en build, crear stubs vacíos: los 3 archivos con `<template><div/></template><script setup></script>` mínimo. Se llenan en Tasks 4-6.)

Si falla, crea los stubs:
```bash
mkdir -p src/components/eventos && for f in EventoAsistentesPanel EventoPoolPanel EventoLinkPublicoShare; do
  echo '<template><div class="text-sm text-text3">Panel pendiente ('$f')</div></template>' > "src/components/eventos/$f.vue"
done
```

Re-build → esperado `✓`.

- [ ] **Step 4: Commit**

```bash
cd crm-frontend && git add src/views/comun/EventoDetalleView.vue src/router/index.js src/components/eventos/ && git commit -m "$(cat <<'EOF'
feat(eventos-multi): EventoDetalleView shell con 3 tabs

Container con header (título, fechas, KPIs del resumen) y 3 tabs
intercambiables: Asistentes | Pool | Link público.

Los 3 sub-panels se implementan en Tasks 4-6 (por ahora stubs).

Nueva ruta: /eventos/:id (requiereAuth).
EOF
)"
```

Attribution: TU trailer.

---

## Task 4: `EventoPoolPanel.vue` — tabla + asignar

**Files:**
- Modify: `crm-frontend/src/components/eventos/EventoPoolPanel.vue` (reemplazar stub)
- Create: `crm-frontend/src/components/eventos/__tests__/EventoPoolPanel.spec.js`

**Interfaces:**
- Props: `evento` (Object requerido).
- Emits: `asignado` (cuando se asigna un pool row).
- Consumes: `eventosAgendaApi.pool(id, {asignado:0})` + `.asignarPool(id, poolId, {asesor_id})`.

- [ ] **Step 1: Test primero**

Path: `crm-frontend/src/components/eventos/__tests__/EventoPoolPanel.spec.js`

```js
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import EventoPoolPanel from '@/components/eventos/EventoPoolPanel.vue';

vi.mock('@/api/agendaApi', () => ({
  eventosAgendaApi: {
    pool: vi.fn(),
    asignarPool: vi.fn()
  }
}));
import { eventosAgendaApi } from '@/api/agendaApi';

const evento = {
  evento_id: 500,
  asistentes: [
    { eva_id: 1, eva_usr_id: 10, eva_activo: 1, usuario: { usr_id: 10, usr_nombre: 'Juan', usr_apellido: 'P' } },
    { eva_id: 2, eva_usr_id: 11, eva_activo: 1, usuario: { usr_id: 11, usr_nombre: 'Ana',  usr_apellido: 'G' } }
  ]
};

function factory() {
  return mount(EventoPoolPanel, {
    props: { evento },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })]
    }
  });
}

beforeEach(() => vi.clearAllMocks());

describe('EventoPoolPanel', () => {
  it('carga pool al montar y muestra filas', async () => {
    eventosAgendaApi.pool.mockResolvedValue({ data: [
      { pool_id: 7, pool_nombre: 'Ana Test', pool_telefono: '3001111', pool_correo: 'a@x' },
      { pool_id: 8, pool_nombre: 'Bob Test', pool_telefono: '3002222', pool_correo: null }
    ]});
    const wrapper = factory();
    await flushPromises();
    expect(eventosAgendaApi.pool).toHaveBeenCalledWith(500, { asignado: 0 });
    expect(wrapper.text()).toContain('Ana Test');
    expect(wrapper.text()).toContain('Bob Test');
  });

  it('estado vacío si no hay registros pendientes', async () => {
    eventosAgendaApi.pool.mockResolvedValue({ data: [] });
    const wrapper = factory();
    await flushPromises();
    expect(wrapper.text()).toContain('Sin registros pendientes');
  });

  it('al asignar llama asignarPool con asesor_id y emite asignado', async () => {
    eventosAgendaApi.pool.mockResolvedValue({ data: [
      { pool_id: 7, pool_nombre: 'Ana Test', pool_telefono: '3001111', pool_correo: null }
    ]});
    eventosAgendaApi.asignarPool.mockResolvedValue({ data: { prospecto: { prosp_id: 900 } } });
    const wrapper = factory();
    await flushPromises();

    await wrapper.find(`[data-testid="select-asesor-7"]`).setValue('10');
    await wrapper.find(`[data-testid="btn-asignar-7"]`).trigger('click');
    await flushPromises();

    expect(eventosAgendaApi.asignarPool).toHaveBeenCalledWith(500, 7, { asesor_id: 10 });
    expect(wrapper.emitted('asignado')).toBeTruthy();
  });
});
```

- [ ] **Step 2: RED**

```bash
cd crm-frontend && npx vitest run src/components/eventos/__tests__/EventoPoolPanel.spec.js 2>&1 | tail -20
```
Expected: FAIL — data-testids no existen (stub actual sólo tiene "Panel pendiente").

- [ ] **Step 3: Implementar el panel**

Path: `crm-frontend/src/components/eventos/EventoPoolPanel.vue`

```vue
<template>
  <div class="space-y-3">
    <div v-if="cargando" class="text-sm text-text3 text-center py-8">Cargando pool...</div>

    <div v-else-if="!pool.length" class="text-sm text-text3 text-center py-8">
      Sin registros pendientes.
      <span v-if="evento?.evento_registros_publicos_habilitado" class="block mt-1 text-xs">
        Comparte el link público para captar leads.
      </span>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="text-xs text-text3 border-b">
          <tr>
            <th class="text-left px-2 py-2">Nombre</th>
            <th class="text-left px-2 py-2">Teléfono</th>
            <th class="text-left px-2 py-2">Correo</th>
            <th class="text-left px-2 py-2">Recibido</th>
            <th class="text-left px-2 py-2">Asignar a</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pool" :key="row.pool_id" class="border-b border-gray-100 hover:bg-gray-50">
            <td class="px-2 py-2 font-medium">{{ row.pool_nombre }}</td>
            <td class="px-2 py-2 text-text2">{{ row.pool_telefono }}</td>
            <td class="px-2 py-2 text-text2">{{ row.pool_correo || '—' }}</td>
            <td class="px-2 py-2 text-xs text-text3">{{ fecha(row.pool_created_at) }}</td>
            <td class="px-2 py-2">
              <div class="flex gap-1">
                <select v-model="asignaciones[row.pool_id]"
                        :data-testid="`select-asesor-${row.pool_id}`"
                        class="text-xs py-1 px-2 border border-gray-300 rounded">
                  <option :value="null">-- Elegir --</option>
                  <option v-for="a in asistentes" :key="a.eva_usr_id" :value="a.eva_usr_id">
                    {{ a.usuario?.usr_nombre }} {{ a.usuario?.usr_apellido }}
                  </option>
                </select>
                <button type="button"
                        :data-testid="`btn-asignar-${row.pool_id}`"
                        :disabled="!asignaciones[row.pool_id] || asignando === row.pool_id"
                        class="text-xs px-2 py-1 bg-primary hover:bg-primary/90 disabled:bg-gray-300 text-white rounded"
                        @click="asignar(row)">
                  {{ asignando === row.pool_id ? '…' : 'Asignar' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({ evento: { type: Object, required: true } });
const emit  = defineEmits(['asignado']);
const toast = useToastStore();

const cargando = ref(true);
const pool = ref([]);
const asignaciones = reactive({});
const asignando = ref(null);

const asistentes = computed(() => (props.evento.asistentes || []).filter(a => a.eva_activo));

async function cargar() {
  cargando.value = true;
  try {
    const r = await eventosAgendaApi.pool(props.evento.evento_id, { asignado: 0 });
    pool.value = r.data || r || [];
    pool.value.forEach(row => { asignaciones[row.pool_id] = null; });
  } catch (e) {
    toast.error('No se pudo cargar el pool');
    pool.value = [];
  } finally {
    cargando.value = false;
  }
}

async function asignar(row) {
  const asesorId = asignaciones[row.pool_id];
  if (!asesorId) return;
  asignando.value = row.pool_id;
  try {
    await eventosAgendaApi.asignarPool(props.evento.evento_id, row.pool_id, { asesor_id: parseInt(asesorId) });
    toast.success(`Asignado a ${row.pool_nombre}`);
    pool.value = pool.value.filter(x => x.pool_id !== row.pool_id);
    emit('asignado');
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo asignar');
  } finally {
    asignando.value = null;
  }
}

function fecha(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short'
  });
}

onMounted(cargar);
</script>
```

- [ ] **Step 4: GREEN**

```bash
cd crm-frontend && npx vitest run src/components/eventos/__tests__/EventoPoolPanel.spec.js 2>&1 | tail -20
```
Expected: PASS 3/3.

- [ ] **Step 5: Commit**

```bash
cd crm-frontend && git add src/components/eventos/EventoPoolPanel.vue src/components/eventos/__tests__/EventoPoolPanel.spec.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): EventoPoolPanel con tabla + asignar

- Carga pool con asignado=0 al montar
- Tabla responsive (nombre/tel/correo/recibido)
- Por fila: select asesor asistente + botón asignar
- Emite 'asignado' tras éxito para que el padre recargue el resumen
- Toast success/error + estado empty

Tests: 3/3.
EOF
)"
```

Attribution: TU trailer.

---

## Task 5: `EventoAsistentesPanel.vue` — lista + edit métricas

**Files:**
- Modify: `crm-frontend/src/components/eventos/EventoAsistentesPanel.vue` (reemplazar stub)

**Interfaces:**
- Props: `evento` (Object).
- Emits: `refresh` (cuando se actualiza una métrica).
- Consumes: `eventosAgendaApi.metricasAsistente(evaId, payload)`.

- [ ] **Step 1: Implementar el panel (sin test dedicado, se valida en smoke UI)**

Path: `crm-frontend/src/components/eventos/EventoAsistentesPanel.vue`

```vue
<template>
  <div class="space-y-2">
    <div v-if="!asistentes.length" class="text-sm text-text3 text-center py-6">
      Este evento no tiene asistentes activos.
    </div>
    <table v-else class="w-full text-sm">
      <thead class="text-xs text-text3 border-b">
        <tr>
          <th class="text-left px-2 py-2">Asistente</th>
          <th class="text-left px-2 py-2">Estado</th>
          <th class="text-right px-2 py-2">Leads</th>
          <th class="text-right px-2 py-2">Prospectos</th>
          <th class="text-right px-2 py-2">Ventas</th>
          <th class="text-right px-2 py-2"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in asistentes" :key="a.eva_id" class="border-b border-gray-100">
          <td class="px-2 py-2 font-medium">{{ nombre(a) }}</td>
          <td class="px-2 py-2">
            <select v-model="edits[a.eva_id].estado"
                    class="text-xs py-1 px-2 border border-gray-300 rounded"
                    @change="cambio(a.eva_id)">
              <option value="CONFIRMADO">Confirmado</option>
              <option value="ASISTIO">Asistió</option>
              <option value="NO_ASISTIO">No asistió</option>
              <option value="JUSTIFICADO">Justificado</option>
            </select>
          </td>
          <td class="px-2 py-2 text-right">
            <input v-model.number="edits[a.eva_id].leads_captados"
                   type="number" min="0"
                   class="w-16 text-xs py-1 px-1 border border-gray-300 rounded text-right"
                   @change="cambio(a.eva_id)" />
          </td>
          <td class="px-2 py-2 text-right">
            <input v-model.number="edits[a.eva_id].prospectos_creados"
                   type="number" min="0"
                   class="w-16 text-xs py-1 px-1 border border-gray-300 rounded text-right"
                   @change="cambio(a.eva_id)" />
          </td>
          <td class="px-2 py-2 text-right">
            <input v-model.number="edits[a.eva_id].ventas_cerradas"
                   type="number" min="0"
                   class="w-16 text-xs py-1 px-1 border border-gray-300 rounded text-right"
                   @change="cambio(a.eva_id)" />
          </td>
          <td class="px-2 py-2 text-right">
            <button v-if="dirty[a.eva_id]" type="button"
                    :disabled="guardando === a.eva_id"
                    class="text-xs px-2 py-1 bg-primary hover:bg-primary/90 text-white rounded"
                    @click="guardar(a.eva_id)">
              {{ guardando === a.eva_id ? '…' : 'Guardar' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { eventosAgendaApi } from '@/api/agendaApi';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({ evento: { type: Object, required: true } });
const emit  = defineEmits(['refresh']);
const toast = useToastStore();

const asistentes = computed(() => (props.evento.asistentes || []).filter(a => a.eva_activo));

const edits     = reactive({});
const dirty     = reactive({});
const guardando = ref(null);

function nombre(a) {
  return `${a.usuario?.usr_nombre || ''} ${a.usuario?.usr_apellido || ''}`.trim();
}

function seedEdits() {
  asistentes.value.forEach(a => {
    edits[a.eva_id] = {
      estado:              a.eva_estado || 'CONFIRMADO',
      leads_captados:      a.eva_leads_captados     ?? null,
      prospectos_creados:  a.eva_prospectos_creados ?? null,
      ventas_cerradas:     a.eva_ventas_cerradas    ?? null
    };
    dirty[a.eva_id] = false;
  });
}
watch(asistentes, seedEdits, { immediate: true, deep: true });

function cambio(evaId) { dirty[evaId] = true; }

async function guardar(evaId) {
  guardando.value = evaId;
  try {
    await eventosAgendaApi.metricasAsistente(evaId, edits[evaId]);
    toast.success('Métricas actualizadas');
    dirty[evaId] = false;
    emit('refresh');
  } catch (e) {
    toast.error(e.response?.data?.error?.message || 'No se pudo guardar');
  } finally {
    guardando.value = null;
  }
}
</script>
```

- [ ] **Step 2: Build**

```bash
cd crm-frontend && npm run build 2>&1 | tail -5
```
Expected: `✓`.

- [ ] **Step 3: Commit**

```bash
cd crm-frontend && git add src/components/eventos/EventoAsistentesPanel.vue && git commit -m "$(cat <<'EOF'
feat(eventos-multi): EventoAsistentesPanel con edit inline de métricas

Tabla de asistentes activos con inputs editables (estado, leads,
prospectos, ventas). Botón 'Guardar' aparece solo si la fila está
dirty. Emite 'refresh' tras cada guardado para que el padre
recargue el resumen.

Sin tests dedicados; se valida en smoke UI de Task 8.
EOF
)"
```

Attribution: TU trailer.

---

## Task 6: `EventoLinkPublicoShare.vue` — mostrar link + copiar

**Files:**
- Modify: `crm-frontend/src/components/eventos/EventoLinkPublicoShare.vue`

**Interfaces:**
- Props: `evento` (Object).

- [ ] **Step 1: Implementar**

Path: `crm-frontend/src/components/eventos/EventoLinkPublicoShare.vue`

```vue
<template>
  <div class="space-y-4">
    <div v-if="!evento.evento_registros_publicos_habilitado"
         class="text-sm text-text3 text-center py-6 bg-gray-50 rounded-lg">
      El link público no está habilitado para este evento.
      <span class="block mt-1 text-xs">
        Edita el evento y marca "Habilitar link público de registro" para generar uno.
      </span>
    </div>
    <div v-else class="space-y-4">
      <div>
        <label class="text-xs font-medium text-text2">URL pública</label>
        <div class="mt-1 flex gap-2">
          <input :value="url" readonly
                 class="flex-1 py-2 px-3 border border-gray-300 rounded-lg text-xs font-mono text-text2 bg-gray-50" />
          <button type="button" class="text-xs px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg"
                  @click="copiar">{{ copiado ? '✓ Copiado' : 'Copiar' }}</button>
          <a :href="url" target="_blank" rel="noopener"
             class="text-xs px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Abrir</a>
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 p-4 bg-gray-50 text-xs text-text2 space-y-2">
        <p><strong class="text-text1">Cómo usarlo:</strong></p>
        <ul class="list-disc pl-4 space-y-1">
          <li>Comparte este link con las personas que quieres que se registren.</li>
          <li>Los registros aparecerán en la pestaña <em>Pool</em> para que los asignes a un asesor asistente.</li>
          <li>El link deja de funcionar automáticamente cuando pase <em>{{ fechaCierre }}</em>.</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToastStore } from '@/stores/useToastStore';

const props = defineProps({ evento: { type: Object, required: true } });
const toast = useToastStore();
const copiado = ref(false);

const url = computed(() => {
  const hash = props.evento.evento_link_hash;
  if (!hash) return '';
  // window.location.origin funciona en producción y dev.
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/genflow/registro-evento/${hash}`;
});

const fechaCierre = computed(() => {
  const f = props.evento.evento_fecha_fin || props.evento.evento_fecha_hora;
  if (!f) return 'la fecha final';
  return new Date(f).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short'
  });
});

async function copiar() {
  try {
    await navigator.clipboard.writeText(url.value);
    copiado.value = true;
    toast.success('Link copiado');
    setTimeout(() => copiado.value = false, 2000);
  } catch (e) {
    toast.error('No se pudo copiar');
  }
}
</script>
```

- [ ] **Step 2: Build + commit**

```bash
cd crm-frontend && npm run build 2>&1 | tail -3 && git add src/components/eventos/EventoLinkPublicoShare.vue && git commit -m "$(cat <<'EOF'
feat(eventos-multi): EventoLinkPublicoShare (copiar + abrir link)

Muestra la URL pública del evento (window.location.origin + /genflow/
registro-evento/:hash), botón copiar (navigator.clipboard) y botón
abrir (nueva pestaña). Si el evento no tiene registros_publicos
habilitado, muestra mensaje explicativo.
EOF
)"
```

Attribution: TU trailer.

---

## Task 7: `RegistroPublicoEventoView.vue` + ruta pública

**Files:**
- Create: `crm-frontend/src/views/public/RegistroPublicoEventoView.vue`
- Modify: `crm-frontend/src/router/index.js`

**Interfaces:**
- Route: `/registro-evento/:hash` → sin auth (`meta: { publica: true }`).
- Consumes: `publicEventosApi.landing(hash)` + `.registrar(hash, payload)`.

- [ ] **Step 1: Crear el view**

Path: `crm-frontend/src/views/public/RegistroPublicoEventoView.vue`

```vue
<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <!-- Loader -->
        <div v-if="cargandoEvento" class="p-8 text-center text-sm text-text3">Cargando...</div>

        <!-- Evento cerrado o no existe -->
        <div v-else-if="!evento" class="p-8 text-center">
          <p class="text-lg font-bold text-red-500 mb-2">{{ errorTitle }}</p>
          <p class="text-sm text-text3">{{ errorMsg }}</p>
        </div>

        <!-- Registro completado -->
        <div v-else-if="registrado" class="p-8 text-center">
          <div class="text-4xl mb-3">✓</div>
          <p class="text-lg font-bold text-text1 mb-2">¡Registro recibido!</p>
          <p class="text-sm text-text3">
            Un asesor te contactará pronto sobre <strong>{{ evento.titulo }}</strong>.
          </p>
        </div>

        <!-- Formulario -->
        <div v-else>
          <header class="bg-gradient-to-br from-green-700 to-green-900 px-8 py-6 text-white">
            <h1 class="font-bold text-lg leading-tight">{{ evento.titulo }}</h1>
            <p class="text-green-200 text-xs mt-1">{{ fechasFmt }}</p>
            <p v-if="evento.empresa_nombre" class="text-green-100 text-xs mt-1">
              {{ evento.empresa_nombre }}
            </p>
          </header>

          <form @submit.prevent="enviar" class="px-8 py-6 space-y-4">
            <p class="text-sm text-text2">Déjanos tus datos para el registro:</p>

            <div>
              <label class="text-xs font-medium text-text2">Nombre completo *</label>
              <input v-model="form.nombre" type="text" required minlength="2" maxlength="180"
                     data-testid="input-nombre"
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-text2">Teléfono *</label>
              <input v-model="form.telefono" type="tel" required
                     data-testid="input-telefono"
                     placeholder="Ej. 3001234567"
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-text2">Correo (opcional)</label>
              <input v-model="form.correo" type="email"
                     data-testid="input-correo"
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>

            <p v-if="errorSubmit" class="text-xs text-red-500">{{ errorSubmit }}</p>

            <button type="submit" data-testid="btn-submit"
                    :disabled="!puedeEnviar || enviando"
                    class="w-full py-2.5 px-4 bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white font-semibold text-sm rounded-lg transition-colors">
              {{ enviando ? 'Enviando...' : 'Enviar registro' }}
            </button>
          </form>
        </div>
      </div>

      <p class="text-center text-xs text-gray-400 mt-4">
        © {{ new Date().getFullYear() }} Los Olivos
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { publicEventosApi } from '@/api/agendaApi';

const route = useRoute();

const cargandoEvento = ref(true);
const evento         = ref(null);
const errorTitle     = ref('Evento no encontrado');
const errorMsg       = ref('El enlace no es válido o el evento ya no acepta registros.');
const registrado     = ref(false);
const enviando       = ref(false);
const errorSubmit    = ref('');
const form = reactive({ nombre: '', telefono: '', correo: '' });

const fechasFmt = computed(() => {
  if (!evento.value?.fecha_inicio) return '';
  const fmt = (d) => new Date(d).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short'
  });
  const inicio = fmt(evento.value.fecha_inicio);
  const fin = evento.value.fecha_fin ? ' → ' + fmt(evento.value.fecha_fin) : '';
  return inicio + fin;
});

const puedeEnviar = computed(() =>
  form.nombre.trim().length >= 2 && form.telefono.trim().length >= 7
);

onMounted(async () => {
  try {
    const r = await publicEventosApi.landing(route.params.hash);
    evento.value = r.data || r;
  } catch (e) {
    const st = e.response?.status;
    if (st === 410) { errorTitle.value = 'Evento cerrado'; errorMsg.value = 'Este evento ya finalizó y no acepta más registros.'; }
    else if (st === 404) { errorTitle.value = 'Evento no encontrado'; errorMsg.value = 'El enlace no es válido o el registro público está deshabilitado.'; }
    else { errorTitle.value = 'Error'; errorMsg.value = 'No pudimos cargar el evento. Intenta más tarde.'; }
  } finally {
    cargandoEvento.value = false;
  }
});

async function enviar() {
  if (!puedeEnviar.value) return;
  enviando.value = true;
  errorSubmit.value = '';
  try {
    await publicEventosApi.registrar(route.params.hash, {
      nombre:   form.nombre.trim(),
      telefono: form.telefono.trim(),
      correo:   form.correo.trim() || undefined
    });
    registrado.value = true;
  } catch (e) {
    const st = e.response?.status;
    if (st === 410) { errorSubmit.value = 'Este evento ya finalizó.'; }
    else if (st === 429) { errorSubmit.value = 'Demasiados intentos, espera un minuto e intenta de nuevo.'; }
    else if (st === 422) { errorSubmit.value = 'Revisa los datos (teléfono en formato válido).'; }
    else { errorSubmit.value = 'No se pudo enviar el registro. Intenta más tarde.'; }
  } finally {
    enviando.value = false;
  }
}
</script>
```

- [ ] **Step 2: Agregar la ruta**

Editar `crm-frontend/src/router/index.js`. Buscar la sección de rutas públicas (`meta: { publica: true }`) — el spec dice que hay varias (líneas 188-194 según ls previo). Agregar:

```js
  // SP-1b · Registro público de eventos
  { path: '/registro-evento/:hash', name: 'registro-evento-publico',
    component: () => import('@/views/public/RegistroPublicoEventoView.vue'),
    meta: { publica: true } },
```

**Nota**: `meta: { publica: true }` activa el `hideShell` en `App.vue`, así el sidebar/header no aparecen. La ruta también es exenta de guards de auth.

- [ ] **Step 3: Verificar que el axios instance NO redirige a login en 401 para rutas públicas**

Run:
```bash
cd crm-frontend && grep -n "interceptors\|401\|redirect" src/api/axios.js | head -20
```

Si hay un interceptor que redirige a login en 401 sin condicional, verificar si esas rutas públicas ya funcionan (Login.vue por ejemplo). Si Login.vue no rompe con esto, la nueva ruta tampoco. Si hay preocupación, agregar guard `if (window.location.pathname.startsWith('/genflow/registro-evento/'))` skip.

Ver si `axios.js` maneja bien el caso — típicamente el problema aparece cuando /public/eventos/:hash responde 200 sin auth y el interceptor no toca la respuesta. Solo 401 provoca redirect. Los endpoints públicos devuelven 200/404/410/429, nunca 401 — así que no hay riesgo real.

Si el implementer NO ve `if (status === 401)` en axios.js, no hacer nada. Si lo ve, verificar que no active para rutas del CRM que no requieren auth (patrón Login.vue).

- [ ] **Step 4: Build + smoke visual**

```bash
cd crm-frontend && npm run build 2>&1 | tail -5
```
Expected: `✓`.

Opcional: `npm run dev` y abrir `http://localhost:5173/genflow/registro-evento/abc123abc123abc123abc123abc12345` — debe mostrar "Evento no encontrado" (esperado, hash falso).

- [ ] **Step 5: Commit**

```bash
cd crm-frontend && git add src/views/public/RegistroPublicoEventoView.vue src/router/index.js && git commit -m "$(cat <<'EOF'
feat(eventos-multi): landing pública RegistroPublicoEventoView

Vista standalone (meta.publica=true → App.vue oculta sidebar/header)
que:
- Carga el evento por hash desde /public/eventos/:hash
- Muestra 3 estados: cargando, cerrado/no-encontrado, formulario, éxito
- Form: nombre + teléfono (required) + correo (opcional)
- POST /public/eventos/:hash/registro con manejo de 410/429/422/500
- Mensaje de éxito tras 201 o 200 dedup

Ruta: /registro-evento/:hash (sin auth).
EOF
)"
```

Attribution: TU trailer.

---

## Task 8: Deploy + smoke UI

**Files:** ninguno.

- [ ] **Step 1: Push**

```bash
cd crm-frontend && git push origin main
```

- [ ] **Step 2: Build final + rsync**

```bash
cd crm-frontend && npm run build 2>&1 | tail -5
rsync -avz --delete "$(pwd)/dist/" /Volumes/AppServ/www/genflow/
```

Verificar que `dist/.htaccess` está presente (creado en Task 020 de SP-4 fix estructural).

- [ ] **Step 3: Smoke UI en producción**

Hard-refresh (Cmd+Shift+R) el CRM y validar:

- [ ] Login como Coordinador Previsión → abre `/agenda` → click en "Nuevo evento" → aparece modal rediseñado con radios de modo_fechas, chips de asistentes, toggle de link público.
- [ ] Crea un evento con modo UNICO + 2 asistentes + toggle público ON → guarda OK → toast success.
- [ ] Navega a `/eventos/<evento_id>` → aparece la vista de detalle con header, KPIs y las 3 tabs.
- [ ] Tab **Link público** → muestra URL con hash + botón Copiar.
- [ ] Abre la URL en pestaña incógnito (sin sesión) → aparece la landing pública minimal (sin sidebar/header) → envía el form → ve mensaje "¡Registro recibido!".
- [ ] Vuelve al CRM → Tab **Pool** del evento → aparece el registro nuevo con select de asesor y botón Asignar → asigna → toast success → el registro desaparece de la lista → tab **Asistentes** muestra al asesor con métrica "Prospectos" > 0 tras recarga (o al editar y guardar).
- [ ] Tab **Asistentes**: cambia el estado o pon un número en "leads" → aparece botón Guardar → click → toast success.

Si algún paso falla, reportar con captura + request/response de la consola.

---

## Notas para el implementador

- **`usuariosApi.listar`** ya existe (endpoint `/api/sv/usuarios?activo=1&limit=200` verificado en SP-4). Si el import no compila, buscar con `grep "usuariosApi" src/api/` y ajustar el path del import.
- **vitest configurado** desde SP-4 Task 6. `stubs: { teleport: true }` es el patrón para modales.
- **`window.location.origin`** en producción devuelve `https://losolivoscucuta.com`. Con base `/genflow/` (vite.config.js), la URL pública compilada es `https://losolivoscucuta.com/genflow/registro-evento/:hash`. Verificar visualmente al probar.
- **PWA cache**: cambios de router requieren hard-refresh + re-registrar SW. Los usuarios pueden ver la versión vieja hasta el próximo prompt "Nueva versión disponible".
- **Attribution**: cada subagente firma con su propio modelo.

---

## Self-review

**1. Spec coverage** — reviso el spec §4.2, §5.2, §6.2 SP-1b:

- ✅ Modal rediseñado (Task 2): modo_fechas, asistentes multi, apoyo, link público, meta_leads.
- ✅ EventoDetalleView con 3 tabs (Task 3).
- ✅ Pool panel (Task 4).
- ✅ Métricas por asistente (Task 5).
- ✅ Link público share (Task 6).
- ✅ Landing pública (Task 7).
- ✅ Router bypass via `meta: { publica: true }` (Task 7).
- ⚠️ El nombre del tab "Métricas" del spec §6.2 se llama "Asistentes" en este plan — decisión de UX (métricas se editan por asistente, así que la tabla es "Asistentes" con columnas de métricas). Coincide con el intent del spec.
- ⚠️ El spec menciona "sección Resumen" como tab separado — el plan lo integró como KPIs en el header del EventoDetalleView. Menos clicks, misma información.

**2. Placeholder scan** — sin TBDs. Los stubs vacíos de Task 3 Step 3 tienen fallback claro.

**3. Type consistency:**
- `eventosAgendaApi.pool/asignarPool/metricasAsistente/resumen` — mismo nombre en Task 1, 3, 4, 5.
- `publicEventosApi.landing/registrar` — mismo nombre Task 1, 7.
- Props `evento` (Object requerido) — pattern consistente entre los 3 panels.
- Emits `asignado` / `refresh` — usados correctamente por el padre.

Sin inconsistencias.
