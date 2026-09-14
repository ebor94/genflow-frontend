<template>
  <!-- ═══════════════════════════════════════════════════════
       1. DATOS DE LA SOLICITUD
  ════════════════════════════════════════════════════════ -->
  <fieldset class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
    <legend class="text-base font-bold text-gray-800 px-2">Datos de la Solicitud</legend>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
      <BaseSelect
        v-model="store.afiliado.sucursal"
        label="Sucursal"
        :options="opcionesSucursal"
        :error="store.errors['sucursal']"
      />

      <BaseSelect
        v-model="store.afiliado.novedad"
        label="Novedad"
        :options="opcionesNovedad"
        :error="store.errors['novedad']"
      />

      <!-- Adjunto contrato competencia — solo cuando novedad = TRASLADO_COMPETENCIA -->
      <div v-if="store.afiliado.novedad === 'TRASLADO_COMPETENCIA'" class="md:col-span-2 lg:col-span-4">
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">
          Contrato de la competencia <span class="text-red-500">*</span>
          <span class="ml-1 text-xs text-gray-400 font-normal">(JPG, PNG o PDF · máx. 5 MB)</span>
        </label>
        <div class="flex items-center gap-3">
          <label class="flex-1 flex items-center gap-2 px-3 py-2.5 border border-dashed rounded-lg cursor-pointer transition-colors"
                 :class="contratoCompetenciaFile ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-white hover:border-green-400 hover:bg-green-50/30'">
            <svg class="w-4 h-4 flex-shrink-0 transition-colors"
                 :class="contratoCompetenciaFile ? 'text-green-600' : 'text-gray-400'"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            <span v-if="!contratoCompetenciaFile && !store.contratoCompetenciaUrl" class="text-sm text-gray-400">Seleccionar contrato...</span>
            <span v-else-if="contratoCompetenciaFile" class="text-sm text-green-700 font-medium truncate">✓ {{ contratoCompetenciaFile.name }}</span>
            <a v-else-if="store.contratoCompetenciaUrl"
               :href="`${apiUrlBase}/uploads/${store.contratoCompetenciaUrl}`"
               target="_blank" rel="noopener"
               class="text-sm text-green-700 font-medium truncate hover:underline"
               @click.stop>✓ {{ store.contratoCompetenciaUrl }}</a>
            <input
              ref="contratoCompetenciaInputRef"
              type="file"
              accept="image/*,.pdf"
              class="sr-only"
              @change="onContratoCompetenciaChange"
            />
          </label>
          <button v-if="contratoCompetenciaFile || store.contratoCompetenciaUrl"
                  @click="limpiarContratoCompetencia"
                  class="text-xs text-red-500 hover:text-red-700 whitespace-nowrap">
            ✕ Quitar
          </button>
        </div>
        <p class="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          El soporte de pago de la competencia también será solicitado en el siguiente paso.
        </p>
      </div>

      <BaseInput
        v-model="store.afiliado.vigenciaDesde"
        label="Vigencia desde"
        type="date"
        :uppercase="true"
        :error="store.errors['vigenciaDesde']"
      />

      <BaseInput
        v-model="store.afiliado.vigenciaHasta"
        label="Vigencia hasta"
        type="date"
        :uppercase="true"
        :error="store.errors['vigenciaHasta']"
      />
    </div>
  </fieldset>

  <!-- ═══════════════════════════════════════════════════════
       2. INFORMACION COMERCIAL
  ════════════════════════════════════════════════════════ -->
  <fieldset class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-5">
    <legend class="text-base font-bold text-gray-800 px-2">Informacion Comercial</legend>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
      <BaseSelect
        v-model="store.afiliado.canal"
        label="Canal"
        :options="opcionesCanal"
        :required="true"
        :error="store.errors['canal']"
      />

      <BaseSelect
        v-model="store.afiliado.producto"
        label="Producto"
        :options="opcionesProducto"
        :required="true"
        :error="store.errors['producto']"
      />

      <BaseSelect
        v-model="store.afiliado.grupo"
        label="Grupo"
        :options="opcionesGrupo"
        :required="true"
        :error="store.errors['grupo']"
      />

      <BaseSelect
        v-model="store.afiliado.asistenciaFueraDeCasa"
        label="Asistencia fuera de casa"
        :options="opcionesSiNo"
        :error="store.errors['asistenciaFueraDeCasa']"
      />
    </div>
  </fieldset>

  <!-- ═══════════════════════════════════════════════════════
       3. DATOS DEL AFILIADO PRINCIPAL
  ════════════════════════════════════════════════════════ -->
  <fieldset class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-5">
    <legend class="text-base font-bold text-gray-800 px-2">Datos del Afiliado Principal</legend>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">

      <!-- Checkbox: afiliado diferente al contratante
           Disponible en TODOS los grupos. En UNIPERSONAL/INDIVIDUAL al
           marcarlo se habilita el formulario para registrar UN beneficiario
           con parentesco ASEGURADO PRINCIPAL. -->
      <div class="md:col-span-2 lg:col-span-3">
        <label class="flex items-center gap-2.5 cursor-pointer select-none group w-fit">
          <input
            type="checkbox"
            v-model="store.afiliado.diferenteAlContratante"
            class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
          />
          <span class="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
            El afiliado es diferente al contratante
          </span>
        </label>
        <p v-if="store.afiliado.diferenteAlContratante" class="mt-1 text-xs text-blue-600 pl-6">
          El primer beneficiario se registrará como Asegurado Principal - (Titular)
        </p>
      </div>

      <BaseSelect
        v-model="store.afiliado.tipoDocumento"
        label="Tipo de documento"
        :options="tiposDocumento"
        :required="true"
        :error="store.errors['tipoDocumento']"
      />

      <!-- Número de documento + botón de búsqueda (segundo contrato) -->
      <div class="relative">
        <BaseInput
          v-model="store.afiliado.numeroDocumento"
          label="Numero de documento"
          placeholder="Ej: 20906230"
          inputmode="numeric"
          :required="true"
          :uppercase="true"
          :error="store.errors['numeroDocumento']"
        />
        <button
          type="button"
          @click="buscarAfiliadoExistente"
          :disabled="buscandoAfiliado || !store.afiliado.numeroDocumento"
          class="absolute right-1.5 top-7 inline-flex items-center justify-center w-8 h-8
                 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300
                 disabled:cursor-not-allowed rounded-md transition-colors"
          title="Buscar si esta persona ya tiene una afiliación previa para precargar sus datos"
        >
          <svg v-if="!buscandoAfiliado" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </button>
      </div>

      <BaseInput
        v-model="store.afiliado.primerApellido"
        label="Primer apellido"
        :required="true"
        :uppercase="true"
        :error="store.errors['primerApellido']"
      />

      <BaseInput
        v-model="store.afiliado.segundoApellido"
        label="Segundo apellido"
        :uppercase="true"
        :error="store.errors['segundoApellido']"
      />

      <BaseInput
        v-model="store.afiliado.primerNombre"
        label="Primer nombre"
        :required="true"
        :uppercase="true"
        :error="store.errors['primerNombre']"
      />

      <BaseInput
        v-model="store.afiliado.segundoNombre"
        label="Segundo nombre"
        :uppercase="true"
        :error="store.errors['segundoNombre']"
      />

      <BaseInput
        v-model="store.afiliado.fechaNacimiento"
        label="Fecha de nacimiento"
        type="date"
        :required="true"
        :uppercase="true"
        :error="store.errors['fechaNacimiento']"
      />

      <BaseInput
        :modelValue="edad"
        label="Edad"
        :readonly="true"
        :disabled="true"
        :uppercase="true"
      />

      <!-- Alerta edad máxima del afiliado (todos los planes) -->
      <div
        v-if="alertaEdadMaxima"
        class="md:col-span-2 lg:col-span-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2"
      >
        <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>{{ alertaEdadMaxima }}</span>
      </div>

      <!-- Alerta edad fuera de rango para grupos unipersonales -->
      <div
        v-if="alertaEdadUnipersonal"
        class="md:col-span-2 lg:col-span-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2"
      >
        <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>{{ alertaEdadUnipersonal }}</span>
      </div>

      <BaseSelect
        v-model="store.afiliado.sexo"
        label="Sexo"
        :options="opcionesSexo"
        :required="true"
        :uppercase="true"
        :error="store.errors['sexo']"
      />

      <BaseSelect
        v-model="store.afiliado.estadoCivil"
        label="Estado civil"
        :options="opcionesEstadoCivil"
        :required="true"
        :error="store.errors['estadoCivil']"
      />

      <div>
        <BaseInput
          v-model="store.afiliado.celular"
          label="Celular"
          placeholder="Ej: 3217200388"
          inputmode="tel"
          :required="true"
          :uppercase="true"
          :error="store.errors['celular']"
        />
        <!-- Indicador informativo: ¿el celular tiene WhatsApp activo? -->
        <label class="mt-2 inline-flex items-center gap-1.5 cursor-pointer select-none group w-fit">
          <input
            type="checkbox"
            v-model="store.afiliado.celularTieneWhatsapp"
            class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500 cursor-pointer"
          />
          <span class="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors flex items-center gap-1">
            <svg class="w-3.5 h-3.5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Tiene WhatsApp
          </span>
        </label>
      </div>

      <BaseInput
        v-model="store.afiliado.celular2"
        label="Celular 2"
        placeholder="Segundo telefono (opcional)"
        inputmode="tel"
        :uppercase="true"
        :error="store.errors['celular2']"
      />

      <BaseInput
        v-model="store.afiliado.email"
        label="Email"
        type="email"
        :uppercase="true"
        placeholder="correo@dominio.com"
        :error="store.errors['email']"
      />

    </div>
  </fieldset>

  <!-- Foto de la Cédula (no Veolia) -->
  <CedulaUpload v-if="store.formMode !== 'veolia'" class="mt-5" />

  <!-- ═══════════════════════════════════════════════════════
       3. UBICACION
  ════════════════════════════════════════════════════════ -->
  <fieldset class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-5">
    <legend class="text-base font-bold text-gray-800 px-2">Ubicacion</legend>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
      <BaseSelect
        v-model="store.afiliado.departamento"
        label="Departamento"
        :options="opcionesDepartamentos"
        :error="store.errors['departamento']"
      />

      <BaseSelect
        v-model="store.afiliado.ciudad"
        label="Ciudad"
        :options="opcionesCiudades"
        :disabled="!store.afiliado.departamento"
        :error="store.errors['ciudad']"
      />

      <BaseInput
        v-model="store.afiliado.barrio"
        label="Barrio"
        :uppercase="true"
        placeholder="Ej: Centro, La Esperanza"
        :error="store.errors['barrio']"
      />

      <div class="md:col-span-2 lg:col-span-3">
        <BaseInput
          v-model="store.afiliado.direccion"
          label="Direccion"
          :uppercase="true"
          placeholder="Ej: Avenida 16 Calle 14 N 30"
          :error="store.errors['direccion']"
        />
      </div>
        <div class="md:col-span-2 lg:col-span-3">
                <BaseInput
          v-model="store.afiliado.cicloEstrato"
          label="Ciclo / Estrato"
          placeholder="Ej: 2 o Estrato 3"
          :required="true"
          :uppercase="true"
          :error="store.errors['cicloEstrato']"
        />
       </div>   

    </div>
      
  </fieldset>

  <!-- ═══════════════════════════════════════════════════════
       4. EMPRESA (solo canal EMPRESARIAL)
  ════════════════════════════════════════════════════════ -->
  <fieldset v-if="store.afiliado.canal === 'EMPRESARIAL'" class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-5">
    <legend class="text-base font-bold text-gray-800 px-2">Empresa</legend>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
      <!-- NIT con boton buscar -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1">NIT</label>
        <div class="flex gap-2">
          <input
            v-model="store.afiliado.nit"
            type="text"
            placeholder="Ej: 900123456"
            inputmode="numeric"
            @keyup.enter="buscarEmpresa"
            class="block w-full rounded-lg border border-gray-300 shadow-sm text-sm px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
          />
          <button
            @click="buscarEmpresa"
            :disabled="buscandoEmpresa || !store.afiliado.nit"
            class="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex items-center gap-1"
          >
            <svg v-if="!buscandoEmpresa" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Buscar
          </button>
        </div>
        <p v-if="estadoNit === 'encontrada'" class="mt-1 text-xs text-green-600 font-medium">✓ Empresa encontrada</p>
        <p v-if="estadoNit === 'nueva'" class="mt-1 text-xs text-amber-600 font-medium">⚠ Empresa no registrada — se creara al guardar</p>
        <p v-if="store.errors['nit']" class="mt-1 text-xs text-red-600">{{ store.errors['nit'] }}</p>
      </div>

      <div class="md:col-span-2">
        <BaseInput
          v-model="store.afiliado.nombreEmpresa"
          label="Nombre de la empresa"
          :uppercase="true"
          placeholder="Busque por NIT o ingrese manualmente"
          :readonly="estadoNit === 'encontrada'"
          :disabled="estadoNit === 'encontrada'"
          :error="store.errors['nombreEmpresa']"
        />
      </div>
    </div>
  </fieldset>

  <!-- ═══════════════════════════════════════════════════════
       6. DATOS CENS (solo visible si canal = CENS)
  ════════════════════════════════════════════════════════ -->
  <Transition name="slide-down">
    <fieldset
      v-if="store.esCanalCens"
      class="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-5 mt-5"
    >
      <legend class="text-base font-bold text-amber-800 px-2">
        Datos CENS <span class="text-amber-600 font-normal text-sm">(requeridos)</span>
      </legend>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
        <BaseInput
          v-model="store.afiliado.usuarioCens"
          label="Usuario CENS"
          placeholder="Ingrese el usuario"
          :required="true"
          :uppercase="true"
          :error="store.errors['usuarioCens']"
        />



        <BaseSelect
          v-model="store.afiliado.relacionPredio"
          label="Relacion con el predio"
          :options="opcionesRelacionPredio"
          :required="true"
          :uppercase="true"
          :error="store.errors['relacionPredio']"
        />
      </div>
    </fieldset>
  </Transition>

  <!-- ═══════════════════════════════════════════════════════
       7. ACTIVIDAD ECONOMICA
  ════════════════════════════════════════════════════════ -->
  <fieldset class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mt-5">
    <legend class="text-base font-bold text-gray-800 px-2">Actividad Economica</legend>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
      <BaseInput
        v-model="store.afiliado.actividadEconomica"
        label="Cargo "
        placeholder="Ej: Comercio al por menor"
        :uppercase="true"
        :error="store.errors['actividadEconomica']"
      />


     <BaseSelect
        v-model="store.afiliado.ocupacion"
        label="Ocupacion"
        :options="ocupaciones"
        :error="store.errors['ocupacion']"
      />

      <BaseSelect
        v-model="store.afiliado.codigoCiiu"
        label="Actividad Economica (CIIU)"
        :options="opcionesCiiu"
        :error="store.errors['codigoCiiu']"
      />
    </div>
  </fieldset>

</template>

<script setup>
import { computed, watch, onMounted, ref } from 'vue'
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'
import { useAgeCalculator } from '@afi/composables/useAgeCalculator'
import { useToastStore } from '@afi/stores/useToastStore'
import { buscarEmpresaPorNit, buscarAfiliadoPorDocumento } from '@afi/api/afiliadoApi'
import BaseInput from '@afi/components/ui/BaseInput.vue'
import BaseSelect from '@afi/components/ui/BaseSelect.vue'
import CedulaUpload from '@afi/components/ui/CedulaUpload.vue'
import { departamentos, ciudadesPorDepartamento } from '@afi/data/colombiaLocations'

const store = useAfiliadoStore()
const toast = useToastStore()

onMounted(() => {
  store.setFormMode('standard')
})

// ── Edad calculada ─────────────────────────────────────────────
const { edad } = useAgeCalculator(computed(() => store.afiliado.fechaNacimiento))
watch(edad, (val) => { store.afiliado.edad = val })

// ── Alerta edad máxima del afiliado (planes estándar, no Veolia) ─
const alertaEdadMaxima = computed(() => {
  if (store.formMode === 'veolia') return null
  if (store.afiliado.diferenteAlContratante) return null
  const e = edad.value
  if (e === 0) return null
  if (e >= 65) return `El afiliado principal debe tener menos de 65 años (edad actual: ${e} años)`
  return null
})
watch(alertaEdadMaxima, (msg) => {
  if (msg) toast.warning(msg)
})

// ── Alerta edad fuera de rango para grupos unipersonales ───────
const alertaEdadUnipersonal = computed(() => {
  if (store.afiliado.canal !== 'INDIVIDUAL') return null
  // Si el check "diferente al contratante" está marcado, NO se valida la
  // edad del contratante — la edad la valida BeneficiarioForm sobre el
  // beneficiario ASEGURADO PRINCIPAL.
  if (store.afiliado.diferenteAlContratante) return null
  const e = edad.value
  if (e === 0) return null
  if (store.afiliado.grupo === 'UNIPERSONAL' && e >= 50)
    return `Unipersonal (menores de 50): el contratante debe tener menos de 50 años (edad actual: ${e} años)`
  if (store.afiliado.grupo === 'INDIVIDUAL' && (e < 50 || e > 65))
    return `Unipersonal (50 a 65 años): el contratante debe tener entre 50 y 65 años (edad actual: ${e} años)`
  return null
})

watch(alertaEdadUnipersonal, (msg) => {
  if (msg) toast.warning(msg)
})

// URL base del backend para links a archivos ya subidos
const apiUrlBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

// ── Búsqueda de afiliado existente (segundo contrato) ──────────
const buscandoAfiliado = ref(false)

async function buscarAfiliadoExistente() {
  const doc = String(store.afiliado.numeroDocumento || '').trim()
  if (!doc) {
    toast.warning('Ingresa el número de documento antes de buscar')
    return
  }
  buscandoAfiliado.value = true
  try {
    const { data } = await buscarAfiliadoPorDocumento(doc)
    if (!data?.data) {
      toast.info('No hay afiliaciones previas con ese documento. Continúa con el registro normal.')
      return
    }
    const a = data.data
    const ok = window.confirm(
      `Se encontró un afiliado registrado:\n\n` +
      `${[a.primerNombre, a.segundoNombre, a.primerApellido, a.segundoApellido].filter(Boolean).join(' ')}\n` +
      `${a.tipoDocumento || ''}: ${a.numeroDocumento || ''}\n\n` +
      '¿Precargar sus datos personales en este formulario?\n' +
      '(Los datos del nuevo contrato, beneficiarios y pago quedan vacíos)'
    )
    if (!ok) return
    store.precargarDatosPersonales(a)
    toast.success('Datos personales precargados. Completa el nuevo contrato.')
  } catch (err) {
    toast.error(err?.response?.data?.message || 'Error al buscar el documento')
  } finally {
    buscandoAfiliado.value = false
  }
}

// ── Ciudad se limpia al cambiar departamento ───────────────────
watch(() => store.afiliado.departamento, () => {
  if (store.cargandoFormulario) return
  store.afiliado.ciudad = ''
})

// ── Limpiar campos CENS si se cambia de canal ──────────────────
watch(() => store.afiliado.canal, (nuevo) => {
  // Durante la carga inicial (borrador/corrección) NO limpiamos en cascada,
  // porque destruiría los valores recién hidratados desde la BD.
  if (store.cargandoFormulario) return
  if (nuevo !== 'CENS') {
    store.afiliado.usuarioCens = ''
    store.afiliado.cicloEstrato = ''
    store.afiliado.relacionPredio = ''
  }
  // Al cambiar canal, limpiar producto y grupo para forzar selección válida
  store.afiliado.producto = ''
  store.afiliado.grupo = ''
})

// ── Limpiar grupo al cambiar producto ──────────────────────────
watch(() => store.afiliado.producto, () => {
  if (store.cargandoFormulario) return
  store.afiliado.grupo = ''
})

// (Nota: anteriormente había un watcher que desmarcaba diferenteAlContratante
//  al cambiar a UNIPERSONAL/INDIVIDUAL. Se eliminó porque ahora estos grupos
//  permiten marcar el check y registrar un ASEGURADO PRINCIPAL como beneficiario.)

// ── Búsqueda de empresa por NIT ────────────────────────────────
const buscandoEmpresa = ref(false)
const estadoNit = ref('') // '' | 'encontrada' | 'nueva'

watch(() => store.afiliado.nit, () => {
  estadoNit.value = ''
  store.afiliado.nombreEmpresa = ''
  store.afiliado.empresaId = null
})

async function buscarEmpresa() {
  const nit = store.afiliado.nit?.trim()
  if (!nit) return
  buscandoEmpresa.value = true
  try {
    const { data } = await buscarEmpresaPorNit(nit)
    if (data.success && data.data) {
      store.afiliado.nombreEmpresa = data.data.nombre
      store.afiliado.empresaId = data.data.id
      estadoNit.value = 'encontrada'
    }
  } catch (err) {
    if (err.response?.status === 404) {
      estadoNit.value = 'nueva'
      toast.info('Empresa no encontrada. Complete el nombre para registrarla.')
    } else {
      toast.error('Error al buscar la empresa')
    }
  } finally {
    buscandoEmpresa.value = false
  }
}

// ── Departamentos y ciudades ───────────────────────────────────
const opcionesDepartamentos = computed(() =>
  departamentos.map(d => ({ value: d, label: d }))
)
const opcionesCiudades = computed(() => {
  if (!store.afiliado.departamento) return []
  const ciudades = ciudadesPorDepartamento[store.afiliado.departamento] || []
  return ciudades.map(c => ({ value: c, label: c }))
})

// ── Listas estáticas ──────────────────────────────────────────
const opcionesSucursal = [
  { value: 'CUCUTA',     label: 'Cucuta' },
  { value: 'PAMPLONA',   label: 'Pamplona' },
  { value: 'OCAÑA',      label: 'Ocaña' },
  { value: 'SARAVENA',   label: 'Saravena' },
  { value: 'ARAUCA',     label: 'Arauca' },
  { value: 'TAME',       label: 'Tame' },
  { value: 'CRISTO REY', label: 'Cristo Rey' },
  { value: 'ARAUQUITA',  label: 'Arauquita' }
]

const opcionesNovedad = [
  { value: 'NUEVO',                label: 'Nuevo' },
  { value: 'CAMBIO',               label: 'Cambio' },
  { value: 'TRASLADO',             label: 'Traslado' },
  { value: 'ACTUALIZACION',        label: 'Actualizacion' },
  { value: 'TRASLADO_COMPETENCIA', label: 'Traslado Competencia' }
]

// ── Contrato de competencia (solo para TRASLADO_COMPETENCIA) ───
const contratoCompetenciaFile     = ref(null)
const contratoCompetenciaInputRef = ref(null)

function onContratoCompetenciaChange(e) {
  const file = e.target.files[0]
  if (!file) return
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
  if (!allowed.includes(file.type)) {
    toast.warning('Solo se permiten imágenes JPG, PNG o PDF')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.warning('El archivo no debe superar 5 MB')
    return
  }
  contratoCompetenciaFile.value = file
  store.setContratoCompetenciaFile(file)
}

function limpiarContratoCompetencia() {
  contratoCompetenciaFile.value    = null
  store.setContratoCompetenciaFile(null)
  store.contratoCompetenciaUrl     = ''
  if (contratoCompetenciaInputRef.value) contratoCompetenciaInputRef.value.value = ''
}

watch(() => store.afiliado.novedad, (val) => {
  if (val !== 'TRASLADO_COMPETENCIA') limpiarContratoCompetencia()
})

const tiposDocumento = [
  { value: 'CC',  label: 'CC - Cedula de ciudadania' },
  { value: 'TI',  label: 'TI - Tarjeta de identidad' },
  { value: 'CE',  label: 'CE - Cedula de extranjeria' },
  { value: 'PA',  label: 'PA - Pasaporte' },
  { value: 'PPT', label: 'PPT' },
  { value: 'NIT', label: 'NIT' }
]

const opcionesSexo = [
  { value: 'F', label: 'Femenino' },
  { value: 'M', label: 'Masculino' },
  { value: 'X', label: 'No especifica' }
]

const opcionesEstadoCivil = [
  { value: 'SOLTERO',     label: 'Soltero(a)' },
  { value: 'CASADO',      label: 'Casado(a)' },
  { value: 'UNION_LIBRE', label: 'Union libre' },
  { value: 'DIVORCIADO',  label: 'Divorciado(a)' },
  { value: 'VIUDO',       label: 'Viudo(a)' },
  { value: 'SEPARADO',    label: 'Separado(a)' }
]

const opcionesCanal = [
  { value: 'EMPRESARIAL', label: 'Empresarial' },
  { value: 'INDIVIDUAL',  label: 'Individual' },
  { value: 'CENS',        label: 'Cens' }
]

// Productos disponibles según canal seleccionado
const opcionesProducto = computed(() => {
  if (store.afiliado.canal === 'INDIVIDUAL') {
    return [{ value: 'INTEGRAL', label: 'Integral' }]
  }
  if (store.afiliado.canal === 'CENS') {
    return [{ value: 'CENS', label: 'Cens' }]
  }
  return [
    { value: 'VERDE',    label: 'Verde' },
    { value: 'INTEGRAL', label: 'Integral' }
  ]
})

// Grupos disponibles según canal + producto seleccionado
const opcionesGrupo = computed(() => {
  const { canal, producto } = store.afiliado
  if (canal === 'INDIVIDUAL' && producto === 'INTEGRAL') {
    return [
      { value: 'BASICO',       label: 'Integral Grupo Basico' },
      { value: 'UNIFAMILIAR',  label: 'Integral Unifamiliar' },
      { value: 'UNIPERSONAL',  label: 'Unipersonal (menores de 50 anos)' },
      { value: 'INDIVIDUAL',   label: 'Unipersonal (50 a 65 anos)' }
    ]
  }
  if (canal === 'CENS') {
    return [
      { value: 'CENS_II', label: 'CENS II' }
    ]
  }
  // Canal EMPRESARIAL u otros
  return [
    { value: 'UNIPERSONAL', label: 'Unipersonal' },
    { value: 'UNIFAMILIAR', label: 'Unifamiliar' },
    { value: 'BASICO',      label: 'Basico' },
    { value: 'TRADICIONAL', label: 'Tradicional' }
  ]
})

const opcionesSiNo = [
  { value: 'SI', label: 'Si' },
  { value: 'NO', label: 'No' }
]

const opcionesRelacionPredio = [
  { value: 'FAMILIAR',    label: 'Familiar' },
  { value: 'ARRENDADO',   label: 'Arrendado' },
  { value: 'PROPIETARIO', label: 'Propietario' }
]

const ocupaciones = [
  { value: 'EMPLEADO',        label: 'Empleado' },
  { value: 'INDEPENDIENTE',   label: 'Independiente' },
  { value: 'PENSIONADO',      label: 'Pensionado' },
  { value: 'ESTUDIANTE',      label: 'Estudiante' },
  { value: 'HOGAR',           label: 'Hogar' },
  { value: 'CESANTE',         label: 'Cesante' },
  { value: 'PERSONA_JURIDICA',label: 'Persona Jurídica' }
]

const opcionesCiiu = [
  { value: '0010', label: '0010 - Asalariados' },
  { value: '0020', label: '0020 - Pensionados' },
  { value: '0085', label: '0085 - Sin actividad económica' },
  { value: '0082', label: '0082 - Personas naturales subsidiadas por terceros' },
  { value: '0090', label: '0090 - Rentistas de Capital' },
  { value: '0111-0322', label: '0111 - 0322 · Agricultura, ganadería, caza, silvicultura y pesca' },
  { value: '1011-3320', label: '1011 - 3320 · Industrias manufactureras' },
  { value: '4111-4390', label: '4111 - 4390 · Construcción' },
  { value: '4511-4799', label: '4511 - 4799 · Comercio al por mayor y al por menor; reparación' },
  { value: '4911-5320', label: '4911 - 5320 · Transporte y almacenamiento' },
  { value: '5511-5630', label: '5511 - 5630 · Alojamiento y servicios de comida' },
  { value: '5811-6399', label: '5811 - 6399 · Información y comunicaciones' },
  { value: '6910-7500', label: '6910 - 7500 · Actividades profesionales, científicas y técnicas' },
  { value: '7710-8299', label: '7710 - 8299 · Actividades de servicios administrativos y de apoyo' },
  { value: '8511-8560', label: '8511 - 8560 · Educación' },
  { value: '8610-8890', label: '8610 - 8890 · Actividades de atención de la salud humana' },
  { value: '9411-9609', label: '9411 - 9609 · Otras actividades de servicios' }
]
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
}
.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 500px;
  transform: translateY(0);
}
</style>
