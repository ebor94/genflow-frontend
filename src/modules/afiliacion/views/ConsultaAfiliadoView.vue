<template>
  <div class="space-y-6">

    <!-- ═══════════════════════════════════════════════════
         ESTADO: idle / enviandoOtp — buscador de documento
         ═══════════════════════════════════════════════════ -->
    <template v-if="estado !== 'mostrandoDatos'">
      <div class="flex gap-3">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="documento"
            type="text"
            placeholder="Número de documento del afiliado..."
            :disabled="estado !== 'idle'"
            class="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase disabled:bg-gray-50 disabled:text-gray-400"
            @keydown.enter="buscar"
          />
        </div>
        <button
          @click="buscar"
          :disabled="estado !== 'idle' || !documento.trim()"
          class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 rounded-lg transition-colors"
        >
          <svg v-if="estado === 'enviandoOtp'" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          {{ estado === 'enviandoOtp' ? 'Enviando código...' : 'Buscar' }}
        </button>
      </div>

      <!-- Error de búsqueda / OTP -->
      <div v-if="errorMensaje" class="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        {{ errorMensaje }}
      </div>
    </template>

    <!-- ═══════════════════════════════════════════════════
         ESTADO: mostrandoDatos — resultados
         ═══════════════════════════════════════════════════ -->
    <template v-if="estado === 'mostrandoDatos' && afiliado">

      <!-- Encabezado con botón "Nueva consulta" -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-emerald-700">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-semibold">Identidad verificada</span>
        </div>
        <button
          @click="nuevaConsulta"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Nueva consulta
        </button>
      </div>

      <!-- Info del afiliado (solo lectura) -->
      <AfiliadoDetalle :afiliado="afiliado" />

      <!-- ── Sección datos de contacto editables ──────── -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h3 class="text-sm font-bold text-gray-800">Actualizar datos de contacto</h3>
          <p class="text-xs text-gray-500 mt-0.5">Puedes actualizar el teléfono, correo y dirección del afiliado principal.</p>
        </div>
        <div class="px-5 py-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Celular principal *</label>
              <input
                v-model="contacto.celular"
                type="text"
                inputmode="numeric"
                maxlength="15"
                class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Celular alternativo</label>
              <input
                v-model="contacto.celular2"
                type="text"
                inputmode="numeric"
                maxlength="15"
                class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Correo electrónico</label>
              <input
                v-model="contacto.email"
                type="email"
                class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-gray-600 mb-1">Dirección</label>
              <input
                v-model="contacto.direccion"
                type="text"
                class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Barrio</label>
              <input
                v-model="contacto.barrio"
                type="text"
                class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Ciudad</label>
              <input
                v-model="contacto.ciudad"
                type="text"
                class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Departamento</label>
              <input
                v-model="contacto.departamento"
                type="text"
                class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase"
              />
            </div>
          </div>

          <div v-if="errorContacto" class="mt-3 text-xs text-red-600 flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            {{ errorContacto }}
          </div>

          <div v-if="contactoOk" class="mt-3 flex items-center gap-2 text-xs text-emerald-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Datos de contacto actualizados correctamente.
          </div>
        </div>
        <div class="px-5 pb-5 flex justify-end">
          <button
            @click="guardarContacto"
            :disabled="guardandoContacto"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 rounded-lg transition-colors"
          >
            <svg v-if="guardandoContacto" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ guardandoContacto ? 'Guardando...' : 'Guardar datos de contacto' }}
          </button>
        </div>
      </div>

      <!-- ── Sección actualización de beneficiarios ────── -->
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-gray-800">Actualizar grupo familiar</h3>
            <p class="text-xs text-gray-500 mt-0.5">Puedes agregar o quitar beneficiarios.</p>
          </div>
          <button
            @click="agregarBeneficiario"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar
          </button>
        </div>

        <!-- Lista de beneficiarios editables -->
        <div v-if="beneficiarios.length > 0" class="divide-y divide-gray-100">
          <div
            v-for="(b, idx) in beneficiarios"
            :key="idx"
            class="px-5 py-3 flex items-center justify-between gap-4"
            :class="b._eliminado ? 'bg-red-50 opacity-60' : ''"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">
                {{ nombreCompleto(b) }}
                <span v-if="b._eliminado" class="text-xs text-red-500 ml-2">— se eliminará</span>
              </p>
              <p class="text-xs text-gray-500">
                {{ b.tipoDocumento }} {{ b.numeroDocumento }} ·
                <span :class="b.tipoBeneficiario === 'DE_LEY' ? 'text-emerald-600' : 'text-violet-600'">
                  {{ b.tipoBeneficiario === 'DE_LEY' ? 'Beneficiario' : 'Adicional' }}
                </span>
                · {{ b.parentesco }}
              </p>
            </div>
            <button
              @click="toggleEliminar(idx)"
              class="flex-shrink-0 p-1.5 rounded-lg transition-colors"
              :class="b._eliminado
                ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                : 'text-red-400 hover:text-red-600 hover:bg-red-50'"
              :title="b._eliminado ? 'Deshacer' : 'Eliminar'"
            >
              <svg v-if="b._eliminado" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        </div>
        <div v-else class="px-5 py-6 text-center text-sm text-gray-400 italic">
          Sin beneficiarios. Usa el botón "Agregar" para añadir.
        </div>

        <!-- Formulario nuevo beneficiario (inline) -->
        <div v-if="showFormNuevo" class="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-3">
          <h4 class="text-sm font-semibold text-gray-700">Nuevo beneficiario</h4>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Tipo documento</label>
              <select v-model="nuevo.tipoDocumento" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">— Seleccionar —</option>
                <option v-for="t in tiposDoc" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Número documento</label>
              <input v-model="nuevo.numeroDocumento" type="text" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Primer nombre</label>
              <input v-model="nuevo.primerNombre" type="text" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Segundo nombre</label>
              <input v-model="nuevo.segundoNombre" type="text" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Primer apellido</label>
              <input v-model="nuevo.primerApellido" type="text" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Segundo apellido</label>
              <input v-model="nuevo.segundoApellido" type="text" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Fecha nacimiento</label>
              <input v-model="nuevo.fechaNacimiento" type="date" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" @change="calcularEdad" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Edad</label>
              <input v-model.number="nuevo.edad" type="number" min="0" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Género</label>
              <select v-model="nuevo.genero" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">— —</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Parentesco</label>
              <select v-model="nuevo.parentesco" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">— Seleccionar —</option>
                <option v-for="p in parentescos" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Tipo beneficiario</label>
              <select v-model="nuevo.tipoBeneficiario" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">— Seleccionar —</option>
                <option value="DE_LEY">Beneficiario</option>
                <option value="ADICIONAL">Adicional</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select v-model="nuevo.estado" class="w-full text-sm border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="INGRESO">Ingreso</option>
                <option value="ACTUALIZACION">Actualización</option>
                <option value="RETIRO">Retiro</option>
              </select>
            </div>
          </div>
          <p v-if="errorNuevo" class="text-xs text-red-600">{{ errorNuevo }}</p>
          <div class="flex gap-2">
            <button @click="confirmarNuevo" class="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">Agregar</button>
            <button @click="cancelarNuevo" class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors">Cancelar</button>
          </div>
        </div>

        <!-- Footer guardar beneficiarios -->
        <div class="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
          <p v-if="hayPendientes" class="text-xs text-amber-600 font-medium">Hay cambios sin guardar.</p>
          <p v-else class="text-xs text-gray-400">Sin cambios.</p>
          <button
            @click="guardarBeneficiarios"
            :disabled="guardandoBeneficiarios || !hayPendientes"
            class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 rounded-lg transition-colors"
          >
            <svg v-if="guardandoBeneficiarios" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ guardandoBeneficiarios ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </div>

      <!-- Toast éxito beneficiarios -->
      <div
        v-if="beneficiariosOk"
        class="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Grupo familiar actualizado correctamente.
      </div>

    </template>

    <!-- ═══════════════════════════════════════════════════
         MODAL OTP
         ═══════════════════════════════════════════════════ -->
    <OtpModal
      :visible="estado === 'esperandoOtp' || estado === 'verificando'"
      :celularMasked="celularMasked"
      :cargando="estado === 'verificando'"
      :error="errorOtp"
      @verificar="onVerificarOtp"
      @reenviar="onReenviarOtp"
      @cancel="nuevaConsulta"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  solicitarOtpPublico,
  verificarOtpPublico,
  actualizarContactoPublico,
  actualizarBeneficiariosConsulta
} from '@afi/api/afiliadoApi'
import AfiliadoDetalle from '@afi/components/aprobacion/AfiliadoDetalle.vue'
import OtpModal from '@afi/components/ui/OtpModal.vue'

const route = useRoute()

// ── Estado de la máquina ──────────────────────────────
// 'idle' | 'enviandoOtp' | 'esperandoOtp' | 'verificando' | 'mostrandoDatos'
const estado       = ref('idle')
const documento    = ref('')
const celularMasked = ref('')
const errorMensaje = ref('')
const errorOtp     = ref('')
const afiliado     = ref(null)

// ── Datos de contacto editables ───────────────────────
const contacto = ref({
  celular: '', celular2: '', email: '',
  direccion: '', barrio: '', ciudad: '', departamento: ''
})
const guardandoContacto = ref(false)
const contactoOk        = ref(false)
const errorContacto     = ref('')

// ── Beneficiarios ──────────────────────────────────────
const beneficiarios      = ref([])
const showFormNuevo      = ref(false)
const guardandoBeneficiarios = ref(false)
const beneficiariosOk    = ref(false)
const errorNuevo         = ref('')
const nuevo              = ref(crearNuevo())

// ── Catálogos ─────────────────────────────────────────
const tiposDoc = ['CC', 'TI', 'CE', 'PA', 'NIT', 'PPT', 'ADT', 'RC']
const parentescos = [
  'ABUELASTRO (A)', 'ABUELO (A)', 'AHIJADO (A)', 'ASEGURADO PRINCIPAL',
  'BISABUELO (A)', 'BISNIETO (A)', 'COMPAÑERO (A)', 'CONYUGE',
  'CUÑADO (A)', 'EX-ESPOSO (A)', 'HERMANASTRO (A)', 'HERMANO (A)',
  'HERMANO CON INCAPACIDAD', 'HIJASTRO (A)', 'HIJO (A)', 'HIJO ADOPTIVO',
  'HIJO CON INCAPACIDAD', 'MADRASTRA', 'MADRE', 'MADRINA',
  'NIETO (A)', 'OTRO', 'PADRASTRO', 'PADRE', 'PADRINO',
  'PRIMO (A)', 'PROTEGIDO (A)', 'SERVICIO DOMESTICO (A)', 'SOBRINO (A)',
  'SUEGRASTRO', 'SUEGRO (A)', 'TIO (A)', 'YERNO/NUERA'
]

// ── Computed ──────────────────────────────────────────
const hayPendientes = computed(() =>
  beneficiarios.value.some(b => b._eliminado || b._nuevo)
)

// ── Helpers ───────────────────────────────────────────
function crearNuevo() {
  return {
    tipoDocumento: '', numeroDocumento: '',
    primerNombre: '', segundoNombre: '',
    primerApellido: '', segundoApellido: '',
    fechaNacimiento: '', edad: '', genero: '',
    parentesco: '', tipoBeneficiario: '', estado: 'INGRESO'
  }
}

function nombreCompleto(p) {
  return [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido]
    .filter(Boolean).join(' ')
}

function calcularEdad() {
  if (!nuevo.value.fechaNacimiento) return
  const hoy = new Date()
  const nac = new Date(nuevo.value.fechaNacimiento)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  nuevo.value.edad = edad
}

function poblarAfiliado(data) {
  afiliado.value = data
  contacto.value = {
    celular:      data.celular      || '',
    celular2:     data.celular2     || '',
    email:        data.email        || '',
    direccion:    data.direccion    || '',
    barrio:       data.barrio       || '',
    ciudad:       data.ciudad       || '',
    departamento: data.departamento || ''
  }
  beneficiarios.value = (data.beneficiarios || [])
    .filter(b => b.activo !== 0)
    .map(b => ({ ...b, _eliminado: false, _nuevo: false }))
}

// ── Flujo OTP ─────────────────────────────────────────

async function buscar() {
  const doc = documento.value.trim()
  if (!doc || estado.value !== 'idle') return
  errorMensaje.value = ''
  estado.value = 'enviandoOtp'
  try {
    const { data } = await solicitarOtpPublico(doc)
    celularMasked.value = data.celularMasked || ''
    errorOtp.value = ''
    estado.value = 'esperandoOtp'
  } catch (e) {
    estado.value = 'idle'
    errorMensaje.value = e.response?.status === 404
      ? 'No se encontró ningún afiliado con ese número de documento.'
      : 'Error al enviar el código. Intenta de nuevo.'
  }
}

async function onVerificarOtp(otp) {
  errorOtp.value = ''
  estado.value = 'verificando'
  try {
    const { data } = await verificarOtpPublico(documento.value.trim(), otp)
    poblarAfiliado(data.data)
    estado.value = 'mostrandoDatos'
  } catch (e) {
    estado.value = 'esperandoOtp'
    errorOtp.value = e.response?.status === 401
      ? 'Código incorrecto o expirado. Intenta de nuevo.'
      : 'Error al verificar. Intenta de nuevo.'
  }
}

async function onReenviarOtp() {
  errorOtp.value = ''
  // El modal ya reinició su contador; enviamos el OTP de nuevo
  try {
    const { data } = await solicitarOtpPublico(documento.value.trim())
    celularMasked.value = data.celularMasked || celularMasked.value
  } catch {
    errorOtp.value = 'Error al reenviar el código. Intenta de nuevo.'
  }
}

function nuevaConsulta() {
  estado.value = 'idle'
  documento.value = ''
  celularMasked.value = ''
  errorMensaje.value = ''
  errorOtp.value = ''
  afiliado.value = null
  beneficiarios.value = []
  contactoOk.value = false
  beneficiariosOk.value = false
  showFormNuevo.value = false
}

// ── Guardar datos de contacto ─────────────────────────

async function guardarContacto() {
  if (!afiliado.value?.id) return
  guardandoContacto.value = true
  contactoOk.value = false
  errorContacto.value = ''
  try {
    const { data } = await actualizarContactoPublico(afiliado.value.id, contacto.value)
    // Actualizar afiliado con datos frescos
    if (data.data) afiliado.value = { ...afiliado.value, ...data.data }
    contactoOk.value = true
    setTimeout(() => { contactoOk.value = false }, 4000)
  } catch {
    errorContacto.value = 'Error al guardar los datos de contacto. Intenta de nuevo.'
  } finally {
    guardandoContacto.value = false
  }
}

// ── Gestión de beneficiarios ──────────────────────────

function toggleEliminar(idx) {
  beneficiarios.value[idx]._eliminado = !beneficiarios.value[idx]._eliminado
}

function agregarBeneficiario() {
  nuevo.value = crearNuevo()
  errorNuevo.value = ''
  showFormNuevo.value = true
}

function confirmarNuevo() {
  const n = nuevo.value
  if (!n.tipoDocumento || !n.numeroDocumento || !n.primerNombre || !n.primerApellido ||
      !n.fechaNacimiento || !n.parentesco || !n.tipoBeneficiario) {
    errorNuevo.value = 'Complete los campos obligatorios.'
    return
  }
  beneficiarios.value.push({ ...n, _nuevo: true, _eliminado: false })
  showFormNuevo.value = false
  errorNuevo.value = ''
}

function cancelarNuevo() {
  showFormNuevo.value = false
  errorNuevo.value = ''
}

async function guardarBeneficiarios() {
  if (!afiliado.value?.id) return
  guardandoBeneficiarios.value = true
  beneficiariosOk.value = false
  try {
    const payload = beneficiarios.value
      .filter(b => !b._eliminado)
      // eslint-disable-next-line no-unused-vars
      .map(({ _eliminado, _nuevo, id, afiliadoId, createdAt, updatedAt, activo, motivoRechazo, ...rest }) => rest)
    await actualizarBeneficiariosConsulta(afiliado.value.id, payload)
    beneficiariosOk.value = true
    // Limpiar flags locales (no podemos re-fetch sin nuevo OTP)
    beneficiarios.value = beneficiarios.value
      .filter(b => !b._eliminado)
      .map(b => ({ ...b, _nuevo: false, _eliminado: false }))
    setTimeout(() => { beneficiariosOk.value = false }, 4000)
  } catch {
    errorContacto.value = 'Error al guardar los cambios. Intenta de nuevo.'
  } finally {
    guardandoBeneficiarios.value = false
  }
}

// ── onMounted ─────────────────────────────────────────
onMounted(() => {
  if (route.params.numerodocumento) {
    documento.value = route.params.numerodocumento
    buscar()
  }
})
</script>
