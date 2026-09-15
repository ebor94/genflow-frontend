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
              <label class="text-xs font-medium text-slate-600">Título</label>
              <input v-model="form.titulo" data-testid="input-titulo" type="text" required
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="text-xs font-medium text-slate-600">Tipo</label>
              <select v-model="form.tipo" data-testid="select-tipo"
                      class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm">
                <option v-for="t in TIPOS" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>

          <!-- Modo de fechas -->
          <div>
            <label class="text-xs font-medium text-slate-600">Modo de fechas</label>
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
              <label class="text-xs font-medium text-slate-600">Fecha inicio</label>
              <input v-model="form.fecha_inicio" data-testid="input-fecha-inicio" type="datetime-local" required
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div v-if="form.modo_fechas === 'DIA_COMPLETO_MULTI'">
              <label class="text-xs font-medium text-slate-600">Fecha fin</label>
              <input v-model="form.fecha_fin" data-testid="input-fecha-fin" type="datetime-local" required
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <!-- Slots (modo SLOTS) -->
          <div v-if="form.modo_fechas === 'SLOTS'" data-testid="slots-picker" class="border border-gray-200 rounded-lg p-3 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-slate-600">Slots</span>
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
            <label class="text-xs font-medium text-slate-600">Asistentes</label>
            <div class="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              <button v-for="u in usuarios" :key="u.usr_id" type="button"
                      :data-testid="`chip-usr-${u.usr_id}`"
                      class="text-xs px-2 py-1 rounded-full border transition"
                      :class="isAsistente(u.usr_id)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-600 border-gray-300 hover:border-primary'"
                      @click="toggleAsistente(u.usr_id)">
                {{ u.usr_nombre }} {{ u.usr_apellido }}
              </button>
            </div>
          </div>

          <!-- Apoyo (opcional) — sólo para roles supervisores; un asesor no puede seleccionar apoyo -->
          <div v-if="puedeVerOtrosUsuarios">
            <label class="text-xs font-medium text-slate-600">Apoyo (opcional)</label>
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
            <label class="text-xs font-medium text-slate-600">Descripción</label>
            <textarea v-model="form.descripcion" rows="2"
                      class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm resize-none"></textarea>
          </div>

          <!-- Toggle registro público + meta -->
          <div class="border-t pt-4 space-y-3">
            <label class="inline-flex items-center gap-2">
              <input type="checkbox" v-model="form.registros_publicos_habilitado" data-testid="toggle-publico">
              <span class="text-sm text-slate-800">Habilitar link público de registro</span>
            </label>
            <div v-if="form.registros_publicos_habilitado">
              <label class="text-xs font-medium text-slate-600">Meta de leads (opcional)</label>
              <input v-model.number="form.meta_leads" data-testid="input-meta-leads" type="number" min="0"
                     class="mt-1 w-full py-2 px-3 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
        </form>

        <footer class="border-t px-6 py-3 flex justify-end gap-2">
          <button type="button" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900" @click="cerrar">Cancelar</button>
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
/**
 * NuevoEventoAgendaModal.vue
 * Crea un evento en la agenda (migración 020 · SP-1a): multi-asesor,
 * rango de fechas o slots por día, apoyo opcional, link público de
 * registro (pool) con meta de leads.
 *
 *   <NuevoEventoAgendaModal
 *      :open="showModal"
 *      :fecha-defecto="'2026-06-25T09:00:00.000Z'"
 *      @close="showModal = false"
 *      @created="onCreado" />
 */
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

// GET /usuarios está gated en el backend por ROLES_SUPERVISORES; para ASESOR/
// AGENTE_SVC devuelve 403. Evitamos la llamada y pre-poblamos con el propio
// usuario (único asistente permitido para esos roles).
const ROLES_SUPERVISORES_FRONT = ['SUPER_ADMIN','GERENTE_GENERAL','DIRECTOR_COMERCIAL','ADMIN_AREA','JEFE_PAP','SUPERVISOR','COORDINADOR_PREVISION'];

const puedeVerOtrosUsuarios = computed(() =>
  ROLES_SUPERVISORES_FRONT.includes(auth.usuario?.rol?.rol_codigo)
);

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
  if (puedeVerOtrosUsuarios.value) {
    try {
      const r = await usuariosApi.list({ activo: 1, limit: 200 });
      usuarios.value = r.data || r;
    } catch (e) {
      toast.error('No se pudieron cargar los usuarios');
    }
  } else {
    // ASESOR/AGENTE_SVC: sólo puede crear eventos consigo mismo como único asistente.
    if (auth.usuario) {
      usuarios.value = [{
        usr_id:       auth.usuario.usr_id,
        usr_nombre:   auth.usuario.usr_nombre,
        usr_apellido: auth.usuario.usr_apellido,
        rol:          auth.usuario.rol
      }];
    }
  }
  if (props.open) reset();
});

function toLocal(iso) {
  if (!iso) return '';
  // Si es sólo fecha (YYYY-MM-DD), anclar a mediodía local para evitar drift UTC
  // (new Date('2026-09-14') se interpreta en UTC y en Colombia -5h cae en el día anterior).
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = soloFecha ? new Date(iso + 'T12:00:00') : new Date(iso);
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
