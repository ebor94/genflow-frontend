<script setup>
import { ref, onMounted, computed } from 'vue';
import { usuariosApi } from '@/api/usuariosApi';
import { configApi } from '@/api/configApi';
import { useToastStore } from '@/stores/useToastStore';
import { useApiError } from '@/composables/useApiError';

import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseModal from '@/components/ui/BaseModal.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import AreaBadge from '@/components/common/AreaBadge.vue';

const toast = useToastStore();
const { notify } = useApiError();

const usuarios = ref([]);
const areas = ref([]);
const grupos = ref([]);
const roles = ref([]);
const puntos = ref([]);
const loading = ref(true);
const q = ref('');

const showModal = ref(false);
const editing = ref(null);
const form = ref({});
const saving = ref(false);

const showResetModal = ref(false);
const resetTarget = ref(null);
const resetPwd = ref('');

async function load() {
  loading.value = true;
  try {
    const [u, a, g, p] = await Promise.all([
      usuariosApi.list(q.value ? { q: q.value } : {}),
      configApi.areas.list(),
      configApi.grupos.list(),
      configApi.puntos.list()
    ]);
    usuarios.value = u.data;
    areas.value = a.data;
    grupos.value = g.data;
    puntos.value = p.data;
  } catch (e) { notify(e); }
  finally { loading.value = false; }
}

onMounted(async () => {
  // TODO: reemplazar este hardcode por GET /api/sv/usuarios/roles cuando exista
  // el endpoint dedicado. Los rol_id corresponden al estado actual de sv_org_roles
  // en producción — si se reordenan, romperán el form.
  roles.value = [
    { rol_id: 1,  rol_codigo: 'SUPER_ADMIN',           rol_nombre: 'Super Administrador',          rol_nivel: 1 },
    { rol_id: 11, rol_codigo: 'GERENTE_GENERAL',       rol_nombre: 'Gerente General',              rol_nivel: 2 },
    { rol_id: 51, rol_codigo: 'DIRECTOR_COMERCIAL',    rol_nombre: 'Director Comercial',           rol_nivel: 2 },
    { rol_id: 2,  rol_codigo: 'ADMIN_AREA',            rol_nombre: 'Administrador de Área',        rol_nivel: 2 },
    { rol_id: 49, rol_codigo: 'JEFE_PAP',              rol_nombre: 'Jefe PAP',                     rol_nivel: 2 },
    { rol_id: 3,  rol_codigo: 'SUPERVISOR',            rol_nombre: 'Supervisor de Grupo',          rol_nivel: 3 },
    { rol_id: 52, rol_codigo: 'COORDINADOR_PREVISION', rol_nombre: 'Coordinador de Previsión',     rol_nivel: 3 },
    { rol_id: 4,  rol_codigo: 'ASESOR',                rol_nombre: 'Asesor Comercial',             rol_nivel: 4 },
    { rol_id: 5,  rol_codigo: 'AGENTE_SVC',            rol_nombre: 'Agente Servicio al Cliente',   rol_nivel: 4 }
  ];
  await load();
});

const opcArea  = computed(() => [{ value: '', label: '—' }, ...areas.value.map(a => ({ value: a.area_id, label: `${a.area_codigo} — ${a.area_nombre}` }))]);
const opcGrupo = computed(() => [{ value: '', label: '—' }, ...grupos.value.map(g => ({ value: g.grupo_id, label: g.grupo_codigo }))]);
const opcRol   = computed(() => roles.value.map(r => ({ value: r.rol_id, label: `${r.rol_codigo} — ${r.rol_nombre}` })));
const opcPunto = computed(() => [{ value: '', label: '—' }, ...puntos.value.map(p => ({ value: p.punto_id, label: p.punto_codigo }))]);

function abrirNuevo() {
  editing.value = null;
  form.value = { usr_area_id: '', usr_grupo_id: '', usr_rol_id: 4, usr_punto_id: '', usr_email: '', usr_nombre: '', usr_apellido: '', usr_telefono: '', usr_password: '', usr_activo: 1 };
  showModal.value = true;
}

function abrirEdicion(u) {
  editing.value = u;
  form.value = {
    usr_area_id: u.usr_area_id || '',
    usr_grupo_id: u.usr_grupo_id || '',
    usr_rol_id: u.usr_rol_id,
    usr_punto_id: u.usr_punto_id || '',
    usr_email: u.usr_email,
    usr_nombre: u.usr_nombre,
    usr_apellido: u.usr_apellido,
    usr_telefono: u.usr_telefono || '',
    usr_activo: u.usr_activo
  };
  showModal.value = true;
}

async function guardar() {
  saving.value = true;
  try {
    const payload = { ...form.value };
    for (const k of ['usr_area_id','usr_grupo_id','usr_punto_id']) {
      if (payload[k] === '' || payload[k] === undefined) payload[k] = null;
      else if (payload[k] != null) payload[k] = parseInt(payload[k]);
    }
    payload.usr_rol_id = parseInt(payload.usr_rol_id);
    if (editing.value) {
      delete payload.usr_password;
      await usuariosApi.update(editing.value.usr_id, payload);
      toast.success('Usuario actualizado.');
    } else {
      await usuariosApi.create(payload);
      toast.success('Usuario creado.');
    }
    showModal.value = false;
    await load();
  } catch (e) { notify(e); }
  finally { saving.value = false; }
}

async function toggle(u) {
  try { await usuariosApi.toggle(u.usr_id); await load(); } catch (e) { notify(e); }
}

function abrirReset(u) {
  resetTarget.value = u;
  resetPwd.value = '';
  showResetModal.value = true;
}

async function ejecutarReset() {
  if (resetPwd.value.length < 6) return toast.warning('Min 6 caracteres');
  try {
    await usuariosApi.resetPassword(resetTarget.value.usr_id, resetPwd.value);
    toast.success(`Contraseña actualizada para ${resetTarget.value.usr_email}`);
    showResetModal.value = false;
  } catch (e) { notify(e); }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
    <header class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <h1 class="font-serif text-3xl text-brown-deep">Usuarios</h1>
      <BaseButton variant="primary" @click="abrirNuevo">+ Nuevo Usuario</BaseButton>
    </header>

    <div class="sv-card p-4 mb-4 flex flex-wrap items-end gap-3">
      <div class="flex-1 min-w-[200px]">
        <BaseInput v-model="q" label="Buscar (nombre, email)" placeholder="Carmen, supervisor.tele..." @keyup.enter="load" />
      </div>
      <BaseButton variant="secondary" @click="load">Buscar</BaseButton>
    </div>

    <div class="sv-card overflow-x-auto">
      <div v-if="loading" class="px-5 py-12 text-text3 text-center">Cargando...</div>
      <EmptyState v-else-if="!usuarios.length" titulo="Sin usuarios" />
      <table v-else class="w-full text-sm">
        <thead class="bg-cream text-text2">
          <tr>
            <th class="text-left px-4 py-3">#</th>
            <th class="text-left px-4 py-3">Nombre</th>
            <th class="text-left px-4 py-3">Email</th>
            <th class="text-left px-4 py-3">Rol</th>
            <th class="text-left px-4 py-3">Área</th>
            <th class="text-left px-4 py-3">Grupo</th>
            <th class="text-left px-4 py-3">Punto</th>
            <th class="text-right px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-text3/10">
          <tr v-for="u in usuarios" :key="u.usr_id" :class="{ 'opacity-50': !u.usr_activo }">
            <td class="px-4 py-3 text-text3">{{ u.usr_id }}</td>
            <td class="px-4 py-3 font-semibold text-text1">{{ u.usr_nombre }} {{ u.usr_apellido }}</td>
            <td class="px-4 py-3 text-text2">{{ u.usr_email }}</td>
            <td class="px-4 py-3"><span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-gold/10 text-gold">{{ u.rol?.rol_codigo }}</span></td>
            <td class="px-4 py-3">
              <AreaBadge v-if="u.area" :codigo="u.area.area_codigo" :nombre="u.area.area_codigo" :color-hex="u.area.area_color_hex" size="sm" />
              <span v-else class="text-text3">—</span>
            </td>
            <td class="px-4 py-3 text-text2">{{ u.grupo?.grupo_codigo || '—' }}</td>
            <td class="px-4 py-3 text-text2">{{ u.punto?.punto_codigo || '—' }}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap space-x-2">
              <BaseButton size="sm" variant="ghost" @click="abrirEdicion(u)">Editar</BaseButton>
              <BaseButton size="sm" variant="ghost" @click="abrirReset(u)">🔑</BaseButton>
              <BaseButton size="sm" :variant="u.usr_activo ? 'secondary' : 'success'" @click="toggle(u)">
                {{ u.usr_activo ? 'Desactivar' : 'Activar' }}
              </BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal crear/editar -->
    <BaseModal :open="showModal" :title="editing ? 'Editar usuario' : 'Nuevo usuario'" max-width="max-w-2xl" @close="showModal = false">
      <form @submit.prevent="guardar" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BaseInput  v-model="form.usr_nombre"   label="Nombres"  required />
        <BaseInput  v-model="form.usr_apellido" label="Apellidos" required />
        <BaseInput  v-model="form.usr_email"    label="Email" type="email" required class="sm:col-span-2" />
        <BaseInput  v-model="form.usr_telefono" label="Teléfono" />
        <BaseSelect v-model="form.usr_rol_id"   label="Rol" :options="opcRol" required />
        <BaseSelect v-model="form.usr_area_id"  label="Área"   :options="opcArea" />
        <BaseSelect v-model="form.usr_grupo_id" label="Grupo"  :options="opcGrupo" />
        <BaseSelect v-model="form.usr_punto_id" label="Punto"  :options="opcPunto" />
        <BaseInput  v-if="!editing" v-model="form.usr_password" label="Contraseña inicial" type="password" required class="sm:col-span-2" />
        <label class="flex items-center gap-3 cursor-pointer sm:col-span-2">
          <input type="checkbox" :checked="!!form.usr_activo" @change="form.usr_activo = $event.target.checked ? 1 : 0" class="w-4 h-4 rounded border-text3/40 text-gold focus:ring-gold" />
          <span class="text-sm text-text2 font-semibold">Activo</span>
        </label>
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="showModal = false">Cancelar</BaseButton>
        <BaseButton variant="primary" :loading="saving" @click="guardar">{{ editing ? 'Guardar' : 'Crear' }}</BaseButton>
      </template>
    </BaseModal>

    <!-- Modal reset password -->
    <BaseModal :open="showResetModal" title="Restablecer contraseña" @close="showResetModal = false">
      <p class="text-sm text-text2 mb-4">
        Vas a establecer una nueva contraseña para <strong>{{ resetTarget?.usr_email }}</strong>.
      </p>
      <BaseInput v-model="resetPwd" label="Nueva contraseña" type="password" required />
      <template #footer>
        <BaseButton variant="secondary" @click="showResetModal = false">Cancelar</BaseButton>
        <BaseButton variant="primary" @click="ejecutarReset">Actualizar</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>
