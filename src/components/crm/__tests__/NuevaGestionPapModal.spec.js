import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';

const gps = vi.hoisted(() => ({ getCurrent: null }));
vi.mock('@/composables/useGeolocation', () => ({
  useGeolocation: () => ({ coords: { value: null }, getCurrent: (...a) => gps.getCurrent(...a), error: { value: null }, obteniendo: { value: false } })
}));

import NuevaGestionPapModal from '@/components/crm/NuevaGestionPapModal.vue';
import { useConfigStore } from '@/stores/useConfigStore';
import { useGestionesStore } from '@/stores/useGestionesStore';

enableAutoUnmount(afterEach);

const RESULTADOS = [
  ['INTERESADO', 'Interesado'], ['VOLVER', 'Volver']
].map(([codigo, nombre], i) => ({ resultado_id: i + 1, resultado_codigo: codigo, resultado_nombre: nombre, resultado_grupo_id: 3, resultado_activo: true }));
const ESTADOS = ['INTERESADO', 'VOLVER'].map((codigo, i) => ({ estado_id: i + 10, estado_codigo: codigo, estado_grupo_id: 3, estado_activo: true }));

async function abrir(resultados = RESULTADOS) {
  gps.getCurrent = vi.fn(async () => null);
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore().actual = { resultados, estados: ESTADOS };
  const store = useGestionesStore();
  store.registrar.mockResolvedValue({});
  const w = mount(NuevaGestionPapModal, {
    props: { open: false, prospecto: { prosp_id: 5, persona: { persona_nombre: 'Ana', persona_telefono_principal: '555' } } },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  await w.setProps({ open: true });
  await flushPromises();
  return { w, store };
}
const boton = (w, txt) => w.findAll('button').find((b) => b.text().includes(txt));

describe('NuevaGestionPapModal: la visita cumple la cita pendiente', () => {
  it('con Interesado quita la cita pendiente', async () => {
    const { w, store } = await abrir();
    await boton(w, 'Interesado').trigger('click');
    await boton(w, 'Registrar visita').trigger('click');
    await flushPromises();
    expect(store.registrar).toHaveBeenCalledWith(expect.objectContaining({ quitar_prox: true, gest_prox_fecha: null }));
  });

  it('con Volver y fecha manda la fecha y no quita la cita', async () => {
    const { w, store } = await abrir();
    await boton(w, 'Volver').trigger('click');
    await w.find('input[type="date"]').setValue('2026-12-01');
    await boton(w, 'Registrar visita').trigger('click');
    await flushPromises();
    expect(store.registrar).toHaveBeenCalledWith(expect.objectContaining({ quitar_prox: false, gest_prox_fecha: '2026-12-01' }));
  });

  it('con Interesado marcado pide fecha: avisa sin ella y la manda con ella', async () => {
    const marcados = RESULTADOS.map((r) => (r.resultado_codigo === 'INTERESADO' ? { ...r, resultado_requiere_fecha: 1 } : r));
    const { w, store } = await abrir(marcados);
    expect(w.find('input[type="date"]').exists()).toBe(false);
    await boton(w, 'Interesado').trigger('click');
    expect(w.text()).toContain('¿Cuándo es el seguimiento?');
    await boton(w, 'Registrar visita').trigger('click');
    await flushPromises();
    expect(store.registrar).not.toHaveBeenCalled();
    await w.find('input[type="date"]').setValue('2026-12-02');
    await boton(w, 'Registrar visita').trigger('click');
    await flushPromises();
    expect(store.registrar).toHaveBeenCalledWith(expect.objectContaining({ quitar_prox: false, gest_prox_fecha: '2026-12-02' }));
  });

  it('Volver pregunta "¿Cuándo volver?"', async () => {
    const { w } = await abrir();
    await boton(w, 'Volver').trigger('click');
    expect(w.text()).toContain('¿Cuándo volver?');
    expect(w.text()).not.toContain('¿Cuándo es el seguimiento?');
  });

  it('cambiar de resultado mientras se espera el GPS no altera lo que se guarda', async () => {
    const marcados = RESULTADOS.concat([{ resultado_id: 3, resultado_codigo: 'NO_INTERESADO', resultado_nombre: 'No interesado', resultado_grupo_id: 3, resultado_activo: true }])
      .map((r) => (r.resultado_codigo === 'INTERESADO' ? { ...r, resultado_requiere_fecha: 1 } : r));
    const { w, store } = await abrir(marcados);
    useConfigStore().actual.estados.push({ estado_id: 30, estado_codigo: 'NO_INTERES', estado_grupo_id: 3, estado_activo: true });
    let soltar;
    gps.getCurrent = vi.fn(() => new Promise((r) => { soltar = r; }));
    await boton(w, 'Interesado').trigger('click');
    await w.find('input[type="date"]').setValue('2026-12-02');
    await boton(w, 'Registrar visita').trigger('click');
    await boton(w, 'No interesado').trigger('click');
    soltar(null);
    await flushPromises();
    expect(store.registrar).toHaveBeenCalledWith(expect.objectContaining({ gest_resultado_id: 1, gest_prox_fecha: '2026-12-02', quitar_prox: false }));
  });
});
