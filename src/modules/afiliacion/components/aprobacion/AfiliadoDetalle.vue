<template>
  <div class="border-t border-gray-100 bg-gray-50">
    <div class="p-5 space-y-5">

      <!-- Datos de identificación -->
      <div>
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Identificación</h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Tipo documento</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.tipoDocumento }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Número documento</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.numeroDocumento }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Primer apellido</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.primerApellido }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Segundo apellido</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.segundoApellido || '—' }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Primer nombre</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.primerNombre }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Segundo nombre</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.segundoNombre || '—' }}</p>
          </div>
        </div>
      </div>

      <!-- Datos personales -->
      <div>
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Datos personales</h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Fecha nacimiento</p>
            <p class="text-sm font-medium text-gray-800">{{ formatDate(afiliado.fechaNacimiento) }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Edad</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.edad }} años</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Sexo</p>
            <p class="text-sm font-medium text-gray-800">{{ labelSexo(afiliado.sexo) }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Estado civil</p>
            <p class="text-sm font-medium text-gray-800">{{ labelEstadoCivil(afiliado.estadoCivil) }}</p>
          </div>
        </div>
      </div>

      <!-- Contacto y ubicación -->
      <div>
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contacto y ubicación</h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Celular</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.celular }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Email</p>
            <p class="text-sm font-medium text-gray-800 truncate">{{ afiliado.email || '—' }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100 col-span-2">
            <p class="text-xs text-gray-400 mb-0.5">Dirección</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.direccion || '—' }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Barrio</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.barrio || '—' }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Ciudad</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.ciudad || '—' }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Departamento</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.departamento || '—' }}</p>
          </div>
        </div>
      </div>

      <!-- Datos comerciales -->
      <div>
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Datos comerciales</h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Canal</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.canal || '—' }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Producto</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.producto || '—' }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Grupo</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.grupo || '—' }}</p>
          </div>
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Asistencia fuera de casa</p>
            <p class="text-sm font-medium" :class="afiliado.asistenciaFueraDeCasa === 'SI' ? 'text-green-600' : 'text-gray-400'">
              {{ afiliado.asistenciaFueraDeCasa === 'SI' ? 'Sí' : 'No' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Productos contratados -->
      <div v-if="afiliado.contrato">
        <TablaProductosAfiliacion :afiliado="afiliado" />
      </div>

      <!-- Beneficiarios -->
      <div v-if="afiliado.beneficiarios && afiliado.beneficiarios.length > 0">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Beneficiarios
          <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {{ afiliado.beneficiarios.length }}
          </span>
        </h4>

        <!-- DE_LEY -->
        <div v-if="beneficiariosDeLey.length > 0" class="mb-4">
          <p class="text-xs font-medium text-emerald-600 mb-2 flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            Beneficiarios ({{ beneficiariosDeLey.length }})
          </p>
          <div class="overflow-x-auto rounded-lg border border-gray-200">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parentesco</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nacimiento</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Edad</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Doc. adjunto</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motivo rechazo</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                <tr v-for="b in beneficiariosDeLey" :key="b.id" :class="b.activo === 0 ? 'bg-red-50 opacity-70' : ''">
                  <td class="px-3 py-2 font-medium whitespace-nowrap" :class="b.activo === 0 ? 'text-red-700 line-through' : 'text-gray-800'">{{ nombreCompleto(b) }}</td>
                  <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ b.tipoDocumento }} {{ b.numeroDocumento }}</td>
                  <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ b.parentesco }}</td>
                  <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ formatDate(b.fechaNacimiento) }}</td>
                  <td class="px-3 py-2 text-gray-600">{{ b.edad }}</td>
                  <td class="px-3 py-2">
                    <span v-if="b.activo === 0" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">INACTIVO</span>
                    <span v-else :class="badgeEstado(b.estado)">{{ b.estado }}</span>
                  </td>
                  <td class="px-3 py-2">
                    <a v-if="b.documentoUrl" :href="fileUrl(b.documentoUrl)" target="_blank"
                       class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      Ver
                    </a>
                    <span v-else class="text-gray-300 text-xs">—</span>
                  </td>
                  <td class="px-3 py-2 text-xs text-gray-500 max-w-xs">
                    <span v-if="b.motivoRechazo" class="text-red-600">{{ b.motivoRechazo }}</span>
                    <span v-else class="text-gray-300">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ADICIONAL -->
        <div v-if="beneficiariosAdicional.length > 0">
          <p class="text-xs font-medium text-violet-600 mb-2 flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-violet-500"></span>
            Adicional ({{ beneficiariosAdicional.length }})
          </p>
          <div class="overflow-x-auto rounded-lg border border-gray-200">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parentesco</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nacimiento</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Edad</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Doc. adjunto</th>
                  <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motivo rechazo</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                <tr v-for="b in beneficiariosAdicional" :key="b.id" :class="b.activo === 0 ? 'bg-red-50 opacity-70' : ''">
                  <td class="px-3 py-2 font-medium whitespace-nowrap" :class="b.activo === 0 ? 'text-red-700 line-through' : 'text-gray-800'">{{ nombreCompleto(b) }}</td>
                  <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ b.tipoDocumento }} {{ b.numeroDocumento }}</td>
                  <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ b.parentesco }}</td>
                  <td class="px-3 py-2 text-gray-600 whitespace-nowrap">{{ formatDate(b.fechaNacimiento) }}</td>
                  <td class="px-3 py-2 text-gray-600">{{ b.edad }}</td>
                  <td class="px-3 py-2">
                    <span v-if="b.activo === 0" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">INACTIVO</span>
                    <span v-else :class="badgeEstado(b.estado)">{{ b.estado }}</span>
                  </td>
                  <td class="px-3 py-2">
                    <a v-if="b.documentoUrl" :href="fileUrl(b.documentoUrl)" target="_blank"
                       class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      Ver
                    </a>
                    <span v-else class="text-gray-300 text-xs">—</span>
                  </td>
                  <td class="px-3 py-2 text-xs text-gray-500 max-w-xs">
                    <span v-if="b.motivoRechazo" class="text-red-600">{{ b.motivoRechazo }}</span>
                    <span v-else class="text-gray-300">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-else class="text-sm text-gray-400 italic">Sin beneficiarios registrados.</div>

      <!-- Seguros contratados (oculto: ya aparecen en la tabla de productos contratados) -->
      <div v-if="false && afiliado.seguros && afiliado.seguros.length > 0" class="mt-1">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Seguros contratados
          <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            {{ afiliado.seguros.length }}
          </span>
        </h4>
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seguro</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prima mensual</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100">
              <tr v-for="s in afiliado.seguros" :key="s.id">
                <td class="px-3 py-2 font-medium text-gray-800">{{ s.nombre }}</td>
                <td class="px-3 py-2 text-gray-600">{{ formatCOP(s.primaTotal) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pago inicial -->
      <div v-if="afiliado.formaPago">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pago inicial</h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Forma de pago</p>
            <p class="text-sm font-medium text-gray-800">{{ afiliado.formaPago }}</p>
          </div>
          <div v-if="afiliado.valorRecibido != null" class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Valor recibido</p>
            <p class="text-sm font-medium text-gray-800">{{ formatCOP(afiliado.valorRecibido) }}</p>
          </div>
          <div v-if="afiliado.referenciaPago1" class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Referencia 1</p>
            <p class="text-sm font-medium text-gray-800 truncate" :title="afiliado.referenciaPago1">{{ afiliado.referenciaPago1 }}</p>
          </div>
          <div v-if="afiliado.referenciaPago2" class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Referencia 2</p>
            <p class="text-sm font-medium text-gray-800 truncate" :title="afiliado.referenciaPago2">{{ afiliado.referenciaPago2 }}</p>
          </div>
          <div v-if="afiliado.referenciaPago3" class="bg-white rounded-lg p-3 border border-gray-100">
            <p class="text-xs text-gray-400 mb-0.5">Referencia 3</p>
            <p class="text-sm font-medium text-gray-800 truncate" :title="afiliado.referenciaPago3">{{ afiliado.referenciaPago3 }}</p>
          </div>
        </div>

        <!-- Soporte de pago adjunto -->
        <div v-if="afiliado.soportePago" class="mt-3">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Soporte de pago</p>
          <a v-if="!isImage(afiliado.soportePago)"
             :href="fileUrl(afiliado.soportePago)" target="_blank"
             class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Ver soporte (PDF)
          </a>
          <img v-else :src="fileUrl(afiliado.soportePago)" alt="Soporte de pago"
               class="max-h-52 max-w-xs rounded-xl border border-gray-200 object-contain shadow-sm" />
        </div>
      </div>

      <!-- Contrato de competencia -->
      <div v-if="afiliado.contratoCompetencia">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contrato de la competencia</h4>
        <a v-if="!isImage(afiliado.contratoCompetencia)"
           :href="fileUrl(afiliado.contratoCompetencia)" target="_blank"
           class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Ver contrato (PDF)
        </a>
        <img v-else :src="fileUrl(afiliado.contratoCompetencia)" alt="Contrato competencia"
             class="max-h-52 max-w-xs rounded-xl border border-gray-200 object-contain shadow-sm" />
      </div>

      <!-- Cédula adjunta -->
      <div v-if="afiliado.cedulaFrontal || afiliado.cedulaReverso">
        <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cédula adjunta</h4>
        <div class="flex flex-wrap gap-5">
          <div v-if="afiliado.cedulaFrontal">
            <p class="text-xs font-medium text-gray-500 mb-1.5">Cara frontal</p>
            <a v-if="!isImage(afiliado.cedulaFrontal)"
               :href="fileUrl(afiliado.cedulaFrontal)" target="_blank"
               class="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Ver PDF
            </a>
            <img v-else :src="fileUrl(afiliado.cedulaFrontal)" alt="Cédula frontal"
                 class="max-h-40 rounded-xl border border-gray-200 object-contain shadow-sm" />
          </div>
          <div v-if="afiliado.cedulaReverso">
            <p class="text-xs font-medium text-gray-500 mb-1.5">Cara reverso</p>
            <a v-if="!isImage(afiliado.cedulaReverso)"
               :href="fileUrl(afiliado.cedulaReverso)" target="_blank"
               class="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Ver PDF
            </a>
            <img v-else :src="fileUrl(afiliado.cedulaReverso)" alt="Cédula reverso"
                 class="max-h-40 rounded-xl border border-gray-200 object-contain shadow-sm" />
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TablaProductosAfiliacion from '@afi/components/afiliado/TablaProductosAfiliacion.vue'

const props = defineProps({
  afiliado: {
    type: Object,
    required: true
  }
})

const beneficiariosDeLey = computed(() =>
  props.afiliado.beneficiarios?.filter(b => b.tipoBeneficiario === 'DE_LEY') ?? []
)

const beneficiariosAdicional = computed(() =>
  props.afiliado.beneficiarios?.filter(b => b.tipoBeneficiario === 'ADICIONAL') ?? []
)

function nombreCompleto(p) {
  return [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido]
    .filter(Boolean).join(' ')
}

function formatDate(date) {
  if (!date) return '—'
  const [year, month, day] = date.split('T')[0].split('-')
  return `${day}/${month}/${year}`
}

function labelSexo(val) {
  return { F: 'Femenino', M: 'Masculino', X: 'No binario' }[val] ?? val
}

function labelEstadoCivil(val) {
  return { UNION_LIBRE: 'Unión libre' }[val] ?? (val ? val.charAt(0) + val.slice(1).toLowerCase() : '—')
}

function badgeEstado(estado) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium'
  const map = {
    INGRESO: `${base} bg-green-100 text-green-700`,
    RETIRO: `${base} bg-red-100 text-red-700`,
    ACTUALIZACION: `${base} bg-yellow-100 text-yellow-700`
  }
  return map[estado] ?? `${base} bg-gray-100 text-gray-600`
}

// VITE_API_URL puede incluir "/api" al final (ej: https://host:8444/api)
// Los archivos estáticos se sirven en la raíz, sin "/api"
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')

function fileUrl(filename) {
  if (!filename) return '#'
  return `${BASE_URL}/uploads/${filename}`
}

function isImage(filename) {
  if (!filename) return false
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
}

function formatCOP(v) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(v || 0)
}
</script>
