<script setup>
defineProps({ visible: Boolean })
defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="$emit('close')"
      >
        <div class="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

          <!-- Header -->
          <div class="bg-gradient-to-br from-green-700 to-green-900 px-6 py-5 rounded-t-2xl flex-shrink-0">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div>
                <h2 class="text-white font-bold text-lg leading-tight">Grupos Asegurables y Tarifas Adicionales</h2>
                <p class="text-green-200 text-sm mt-0.5">Lea esta información antes de registrar el grupo familiar</p>
              </div>
            </div>
          </div>

          <!-- Body con scroll -->
          <div class="overflow-y-auto flex-1 px-6 py-5 space-y-6">

            <!-- ── Grupos Asegurables ──────────────────────────── -->
            <section>
              <h3 class="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                <span class="inline-block w-2 h-2 rounded-full bg-green-600"></span>
                Grupos Asegurables
                <span class="text-xs font-normal text-gray-400 ml-1">(aplica para todos los colaboradores sin importar fecha de ingreso)</span>
              </h3>

              <div class="space-y-3">

                <!-- 1. Grupo Básico Soltero -->
                <div class="rounded-lg border border-blue-200 overflow-hidden">
                  <div class="bg-blue-600 text-white px-4 py-2.5 flex items-center gap-2">
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/>
                    </svg>
                    <span class="font-semibold text-sm">Grupo Familiar Básico — Soltero sin hijos</span>
                  </div>
                  <div class="px-4 py-3 bg-blue-50">
                    <ul class="text-sm text-gray-700 space-y-1.5">
                      <li class="flex items-start gap-2">
                        <span class="text-blue-500 font-bold mt-0.5">•</span>
                        <span><strong>Titular Principal:</strong> sin límite de edad de ingreso y permanencia</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-blue-500 font-bold mt-0.5">•</span>
                        <span><strong>Padres:</strong> sin límite de edad de ingreso y de permanencia. Podrán incluir a padrastros o madrastras, pero su inclusión no dará lugar al ingreso de padre y madre.</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-blue-500 font-bold mt-0.5">•</span>
                        <span><strong>Hermanos:</strong> hasta cumplir 30 años (al cumplir esta edad pasan como adicionales, pagando cuota correspondiente), hermanos discapacitados sin límite de edad de ingreso y de permanencia y hermanos fallecidos en estado gestación.</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-amber-500 font-bold mt-0.5">•</span>
                        <span><strong>A falta de padres:</strong> puede incluir 2 familiares menores de 50 años (parientes hasta 4.° grado de consanguinidad, 2.° de afinidad o único civil). Deben estar reportados para autorizar la prestación del servicio.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- 3. Grupo Básico Casado / Con hijos -->
                <div class="rounded-lg border border-green-200 overflow-hidden">
                  <div class="bg-green-600 text-white px-4 py-2.5 flex items-center gap-2">
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                    </svg>
                    <span class="font-semibold text-sm">Grupo Familiar Básico — Casado o con hijos</span>
                  </div>
                  <div class="px-4 py-3 bg-green-50">
                    <ul class="text-sm text-gray-700 space-y-1.5">
                      <li class="flex items-start gap-2">
                        <span class="text-green-600 font-bold mt-0.5">•</span>
                        <span><strong>Titular Principal:</strong> sin límite de edad de ingreso y permanencia</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-green-600 font-bold mt-0.5">•</span>
                        <span><strong>Cónyuge / Compañero(a) permanente:</strong> sin límite de edad de ingreso y permanencia</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-green-600 font-bold mt-0.5">•</span>
                        <span><strong>Hijos e Hijastros:</strong> hasta cumplir 30 años (al cumplir esta edad pasan como adicionales, pagando cuota correspondiente), hijos e hijastros discapacitados sin límite de edad de ingreso y de permanencia y los hijos fallecidos en estado gestación.</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-green-600 font-bold mt-0.5">•</span>
                        <span><strong>Padres o Suegros:</strong> sin límite de edad de ingreso y de permanencia. Podrán incluir a padrastros o madrastras, pero su inclusión no dará lugar al ingreso de padre, madre o suegros.</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-amber-500 font-bold mt-0.5">•</span>
                        <span><strong>A falta de padres, padrastros o suegros:</strong> puede incluir 2 familiares menores de 50 años (parientes hasta 4.° grado de consanguinidad, 2.° de afinidad o único civil). Deben estar reportados para autorizar la prestación del servicio.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- 4. Adicionales -->
                <div class="rounded-lg border border-purple-200 overflow-hidden">
                  <div class="bg-purple-600 text-white px-4 py-2.5 flex items-center gap-2">
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    <span class="font-semibold text-sm">Asegurados Adicionales <span class="font-normal text-purple-200">(Genera costo)</span></span>
                  </div>
                  <div class="px-4 py-3 bg-purple-50">
                    <ul class="text-sm text-gray-700 space-y-1.5">
                      <li class="flex items-start gap-2">
                        <span class="text-purple-600 font-bold mt-0.5">•</span>
                        <div>
                          <span>Parientes hasta <strong>4.° grado de consanguinidad</strong>, 2.° de afinidad y único civil, incluyendo <strong>Servicio Doméstico</strong>:</span>
                          <div class="mt-2 flex flex-wrap gap-1.5">
                            <span v-for="p in [
                              'Padres','Hijos','Hermanos','Abuelos','Nietos',
                              'Bisnietos','Bisabuelos','Tíos','Sobrinos',
                              'Tataranietos','Tatarabuelos','Primos',
                              'Cónyuge','Suegros','Yernos','Nueras',
                              'Madrastras','Padrastros','Hijastros',
                              'Hermanastros','Cuñados','Hijos en adopción',
                              'Personal de servicio doméstico'
                            ]" :key="p"
                              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800 border border-purple-200 font-medium">
                              {{ p }}
                            </span>
                          </div>
                        </div>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-purple-600 font-bold mt-0.5">•</span>
                        <span><strong>Sin límite de edad</strong> de ingreso ni de permanencia. La tarifa se aplica según rango de edad (ver tabla de tarifas arriba).</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-purple-600 font-bold mt-0.5">•</span>
                        <span>Pueden incluirse en cualquier momento de la vigencia</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-amber-600 font-bold mt-0.5">⚠</span>
                        <span><strong>Carencia para muerte natural:</strong> 90 días</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-green-600 font-bold mt-0.5">✓</span>
                        <span><strong>Cobertura inmediata</strong> para muerte por suicidio u homicidio (exequias) desde la vigencia del plan</span>
                      </li>
                    </ul>
                  </div>
                </div>

              </div>
            </section>

            <!-- ── Tarifas Adicionales ─────────────────────────── -->
            <section>
              <h3 class="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                <span class="inline-block w-2 h-2 rounded-full bg-green-600"></span>
                Tarifas Adicionales
              </h3>
              <div class="overflow-x-auto rounded-lg border border-gray-200">
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr class="bg-yellow-400 text-gray-900">
                      <th class="px-4 py-2 text-left font-bold border-b border-yellow-500">Edad</th>
                      <th class="px-4 py-2 text-center font-bold border-b border-yellow-500">PLATINO<br><span class="font-normal text-xs">Valor mes</span></th>
                      <th class="px-4 py-2 text-center font-bold border-b border-yellow-500">ORO<br><span class="font-normal text-xs">Valor mes</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="px-4 py-2 text-gray-700">Menores de 70 años</td>
                      <td class="px-4 py-2 text-center font-medium text-gray-800">$ 4.207</td>
                      <td class="px-4 py-2 text-center font-medium text-gray-800">$ 6.338</td>
                    </tr>
                    <tr class="border-b border-gray-100 hover:bg-gray-50">
                      <td class="px-4 py-2 text-gray-700">Menores de 80 años</td>
                      <td class="px-4 py-2 text-center font-medium text-gray-800">$ 20.215</td>
                      <td class="px-4 py-2 text-center font-medium text-gray-800">$ 26.771</td>
                    </tr>
                    <tr class="hover:bg-gray-50">
                      <td class="px-4 py-2 text-gray-700">Mayores de 80 años</td>
                      <td class="px-4 py-2 text-center font-medium text-gray-800">$ 29.800</td>
                      <td class="px-4 py-2 text-center font-medium text-gray-800">$ 36.800</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

          </div>

          <!-- Footer -->
          <div class="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button
              @click="$emit('close')"
              class="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-green-700 hover:bg-green-800 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Entendido — Continuar con el registro
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>
