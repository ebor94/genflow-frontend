<script setup>
import { useAfiliadoStore } from '@afi/stores/useAfiliadoStore'

const emit = defineEmits(['edit'])
const store = useAfiliadoStore()

function confirmarEliminar(index) {
  if (confirm('Esta seguro de eliminar este beneficiario?')) {
    store.removeBeneficiario(index)
  }
}

// Devuelve el índice global en store.beneficiarios dado el tipo y el índice local
function globalIndex(tipo, localIdx) {
  if (tipo === 'DE_LEY') return localIdx
  return store.beneficiariosDeLey.length + localIdx
}

function handleEdit(tipo, localIdx) {
  const idx = globalIndex(tipo, localIdx)
  emit('edit', store.beneficiarios[idx], idx)
}

function fullName(b) {
  return [b.primerNombre, b.segundoNombre].filter(Boolean).join(' ')
}

function fullLast(b) {
  return [b.primerApellido, b.segundoApellido].filter(Boolean).join(' ')
}

function formatValor(v) {
  if (v === null || v === undefined || v === '') return '-'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)
}
</script>

<template>
  <div class="space-y-6">

    <!-- ── Beneficiarios ──────────────────────────────────────── -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <h4 class="text-sm font-bold text-gray-700">Beneficiarios</h4>
        <span class="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-semibold">
          {{ store.beneficiariosDeLey.length }}
        </span>
      </div>

      <div v-if="store.beneficiariosDeLey.length === 0"
           class="text-sm text-gray-400 italic py-3 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        No se han agregado beneficiarios
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-blue-50 text-blue-900">
              <th class="border border-blue-200 px-3 py-2 text-left">#</th>
              <th class="border border-blue-200 px-3 py-2 text-left">Parentesco</th>
              <th class="border border-blue-200 px-3 py-2 text-left">Genero</th>
              <th class="border border-blue-200 px-3 py-2 text-left">Tipo Doc</th>
              <th class="border border-blue-200 px-3 py-2 text-left">N. Doc</th>
              <th class="border border-blue-200 px-3 py-2 text-left">Apellidos</th>
              <th class="border border-blue-200 px-3 py-2 text-left">Nombres</th>
              <th class="border border-blue-200 px-3 py-2 text-left">F. Nacimiento</th>
              <th class="border border-blue-200 px-3 py-2 text-left">Edad</th>
              <th v-if="store.formMode !== 'veolia'" class="border border-blue-200 px-3 py-2 text-right">Valor</th>
              <th class="border border-blue-200 px-3 py-2 text-right">Tipo solicitud</th>
              <th class="border border-blue-200 px-3 py-2 text-center">Accion</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(b, idx) in store.beneficiariosDeLey" :key="'ley-'+idx"
                class="hover:bg-blue-50/50 transition-colors">
              <td class="border border-gray-200 px-3 py-2 text-gray-500">{{ idx + 1 }}</td>
              <td class="border border-gray-200 px-3 py-2">{{ b.parentesco }}</td>
              <td class="border border-gray-200 px-3 py-2 text-center">
                <span v-if="b.genero" :class="b.genero === 'M' ? 'text-blue-600' : 'text-pink-600'" class="font-bold">
                  {{ b.genero }}
                </span>
                <span v-else class="text-gray-300">-</span>
              </td>
              <td class="border border-gray-200 px-3 py-2">{{ b.tipoDocumento }}</td>
              <td class="border border-gray-200 px-3 py-2 font-mono text-xs">{{ b.numeroDocumento }}</td>
              <td class="border border-gray-200 px-3 py-2">{{ fullLast(b) }}</td>
              <td class="border border-gray-200 px-3 py-2">{{ fullName(b) }}</td>
              <td class="border border-gray-200 px-3 py-2 text-xs">{{ b.fechaNacimiento }}</td>
              <td class="border border-gray-200 px-3 py-2 text-center">{{ b.edad }}</td>
              <td v-if="store.formMode !== 'veolia'" class="border border-gray-200 px-3 py-2 text-right text-xs">{{ formatValor(b.valorPorPersona) }}</td>
              <td class="border border-gray-200 px-3 py-2 text-right text-xs">{{ b.estado }}</td>
              <td class="border border-gray-200 px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-2">
                  <!-- Editar -->
                  <button @click="handleEdit('DE_LEY', idx)"
                          class="text-blue-500 hover:text-blue-700 transition-colors" title="Editar">
                    <svg class="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                  <!-- Eliminar -->
                  <button @click="confirmarEliminar(globalIndex('DE_LEY', idx))"
                          class="text-red-500 hover:text-red-700 transition-colors" title="Eliminar">
                    <svg class="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Beneficiarios Adicionales ──────────────────────────── -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <h4 class="text-sm font-bold text-gray-700">Beneficiarios adicionales</h4>
        <span class="inline-flex items-center rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-xs font-semibold">
          {{ store.beneficiariosAdicional.length }}
        </span>
      </div>

      <div v-if="store.beneficiariosAdicional.length === 0"
           class="text-sm text-gray-400 italic py-3 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        No se han agregado beneficiarios adicionales
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-purple-50 text-purple-900">
              <th class="border border-purple-200 px-3 py-2 text-left">#</th>
              <th class="border border-purple-200 px-3 py-2 text-left">Parentesco</th>
              <th class="border border-purple-200 px-3 py-2 text-left">Genero</th>
              <th class="border border-purple-200 px-3 py-2 text-left">Tipo Doc</th>
              <th class="border border-purple-200 px-3 py-2 text-left">N. Doc</th>
              <th class="border border-purple-200 px-3 py-2 text-left">Apellidos</th>
              <th class="border border-purple-200 px-3 py-2 text-left">Nombres</th>
              <th class="border border-purple-200 px-3 py-2 text-left">F. Nacimiento</th>
              <th class="border border-purple-200 px-3 py-2 text-left">Edad</th>
              <th v-if="store.formMode !== 'veolia'" class="border border-purple-200 px-3 py-2 text-right">Valor</th>
              <th class="border border-purple-200 px-3 py-2 text-right">Tipo solicitud</th>
              <th class="border border-purple-200 px-3 py-2 text-center">Accion</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(b, idx) in store.beneficiariosAdicional" :key="'adic-'+idx"
                :class="[
                  'transition-colors',
                  b.estado === 'RETIRO'
                    ? 'bg-red-50/60 hover:bg-red-50'
                    : 'hover:bg-purple-50/50'
                ]">
              <td class="border border-gray-200 px-3 py-2 text-gray-500">{{ idx + 1 }}</td>
              <td class="border border-gray-200 px-3 py-2">{{ b.parentesco }}</td>
              <td class="border border-gray-200 px-3 py-2 text-center">
                <span v-if="b.genero" :class="b.genero === 'M' ? 'text-blue-600' : 'text-pink-600'" class="font-bold">
                  {{ b.genero }}
                </span>
                <span v-else class="text-gray-300">-</span>
              </td>
              <td class="border border-gray-200 px-3 py-2">{{ b.tipoDocumento }}</td>
              <td class="border border-gray-200 px-3 py-2 font-mono text-xs">{{ b.numeroDocumento }}</td>
              <td class="border border-gray-200 px-3 py-2">{{ fullLast(b) }}</td>
              <td class="border border-gray-200 px-3 py-2">{{ fullName(b) }}</td>
              <td class="border border-gray-200 px-3 py-2 text-xs">{{ b.fechaNacimiento }}</td>
              <td class="border border-gray-200 px-3 py-2 text-center">{{ b.edad }}</td>
              <td v-if="store.formMode !== 'veolia'" class="border border-gray-200 px-3 py-2 text-right text-xs">
                <span v-if="b.estado === 'RETIRO'" class="text-red-500 font-medium">$0 (retiro)</span>
                <span v-else>{{ formatValor(b.valorPorPersona) }}</span>
              </td>
              <td class="border border-gray-200 px-3 py-2 text-right text-xs">
                <span :class="b.estado === 'RETIRO' ? 'text-red-600 font-semibold' : ''">
                  {{ b.estado }}
                </span>
              </td>
              <td class="border border-gray-200 px-3 py-2 text-center">
                <div class="flex items-center justify-center gap-2">
                  <!-- Editar -->
                  <button @click="handleEdit('ADICIONAL', idx)"
                          class="text-blue-500 hover:text-blue-700 transition-colors" title="Editar">
                    <svg class="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </button>
                  <!-- Eliminar -->
                  <button @click="confirmarEliminar(globalIndex('ADICIONAL', idx))"
                          class="text-red-500 hover:text-red-700 transition-colors" title="Eliminar">
                    <svg class="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>
