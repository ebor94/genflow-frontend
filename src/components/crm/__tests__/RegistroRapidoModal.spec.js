import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/composables/useGeolocation', () => ({
  useGeolocation: () => ({ coords: { value: null }, getCurrent: vi.fn(async () => null), error: { value: null }, obteniendo: { value: false } })
}));

import RegistroRapidoModal from '@/components/crm/RegistroRapidoModal.vue';
import { useConfigStore } from '@/stores/useConfigStore';
import { usePapStore } from '@/stores/usePapStore';
import { useToastStore } from '@/stores/useToastStore';

enableAutoUnmount(afterEach);

describe('RegistroRapidoModal: fecha sugerida al volver', () => {
  afterEach(() => vi.useRealTimers());

  it('después de las 7 p. m. sugiere mañana, no pasado mañana', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T20:30:00'));
    const w = mount(RegistroRapidoModal, {
      props: { open: false },
      global: { plugins: [createTestingPinia({ createSpy: vi.fn })], stubs: { teleport: true } }
    });
    await w.setProps({ open: true });
    await flushPromises();
    await w.findAll('button').find((b) => b.text().includes('Volver')).trigger('click');
    await flushPromises();
    expect(w.find('input[type="date"]').element.value).toBe('2026-11-26');
  });
});

const catalogo = (interesadoPide = 1) => [
  { resultado_codigo: 'INTERESADO', resultado_grupo_id: 3, resultado_activo: true, resultado_requiere_fecha: interesadoPide },
  { resultado_codigo: 'SIN_RESPUESTA', resultado_grupo_id: 3, resultado_activo: true, resultado_requiere_fecha: interesadoPide }
];
async function abrir(resultados) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-25T10:00:00'));
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore().actual = { resultados, productos: [] };
  const pap = usePapStore();
  pap.registrar.mockResolvedValue({ resultado: 'ok' });
  const w = mount(RegistroRapidoModal, { props: { open: false }, global: { plugins: [pinia], stubs: { teleport: true } } });
  await w.setProps({ open: true });
  await flushPromises();
  return { w, pap, toast: useToastStore() };
}
const boton = (w, txt) => w.findAll('button').find((b) => b.text().includes(txt));

describe('RegistroRapidoModal: Interesado pide fecha según el catálogo', () => {
  afterEach(() => vi.useRealTimers());

  it('con Interesado marcado muestra el campo, sugiere mañana 09:00 y lo manda', async () => {
    const { w, pap } = await abrir(catalogo(1));
    await w.findAll('input')[0].setValue('Ana');
    await w.findAll('input')[1].setValue('555');
    await boton(w, 'Interesado').trigger('click');
    await flushPromises();
    expect(w.find('input[type="date"]').element.value).toBe('2026-11-26');
    expect(w.find('input[type="time"]').element.value).toBe('09:00');
    await boton(w, 'Guardar y nuevo').trigger('click');
    await flushPromises();
    expect(pap.registrar).toHaveBeenCalledWith(expect.objectContaining({ prox_fecha: '2026-11-26', prox_hora: '09:00' }));
  });

  it('si se borra la fecha avisa y no registra', async () => {
    const { w, pap, toast } = await abrir(catalogo(1));
    await w.findAll('input')[0].setValue('Ana');
    await w.findAll('input')[1].setValue('555');
    await boton(w, 'Interesado').trigger('click');
    await flushPromises();
    await w.find('input[type="date"]').setValue('');
    await boton(w, 'Guardar y nuevo').trigger('click');
    await flushPromises();
    expect(toast.warning).toHaveBeenCalled();
    expect(pap.registrar).not.toHaveBeenCalled();
  });

  it('con No interesado manda fecha y hora nulas aunque antes se eligiera fecha', async () => {
    const { w, pap } = await abrir(catalogo(1));
    await w.findAll('input')[0].setValue('Ana');
    await w.findAll('input')[1].setValue('555');
    await boton(w, 'Interesado').trigger('click');
    await flushPromises();
    await boton(w, 'No interesado').trigger('click');
    await boton(w, 'Guardar y nuevo').trigger('click');
    await flushPromises();
    expect(pap.registrar).toHaveBeenCalledWith(expect.objectContaining({ prox_fecha: null, prox_hora: null }));
  });

  it('"Sin respuesta" sin marcar registra de una vez', async () => {
    const { w, pap } = await abrir(catalogo(0));
    await boton(w, 'Sin respuesta').trigger('click');
    await flushPromises();
    expect(pap.registrar).toHaveBeenCalledWith(expect.objectContaining({ resultado_codigo: 'SIN_RESPUESTA', prox_fecha: null }));
  });

  it('"Sin respuesta" marcada no registra hasta tener fecha', async () => {
    const { w, pap, toast } = await abrir(catalogo(1));
    await boton(w, 'Sin respuesta').trigger('click');
    await flushPromises();
    expect(toast.warning).toHaveBeenCalled();
    expect(pap.registrar).not.toHaveBeenCalled();
  });

  it('"Guardar" también avisa sin fecha y registra con ella', async () => {
    const { w, pap, toast } = await abrir(catalogo(1));
    await w.findAll('input')[0].setValue('Ana');
    await w.findAll('input')[1].setValue('555');
    await boton(w, 'Interesado').trigger('click');
    await flushPromises();
    await w.find('input[type="date"]').setValue('');
    await boton(w, '💾 Guardar').trigger('click');
    await flushPromises();
    expect(toast.warning).toHaveBeenCalled();
    expect(pap.registrar).not.toHaveBeenCalled();
    await w.find('input[type="date"]').setValue('2026-12-03');
    await boton(w, '💾 Guardar').trigger('click');
    await flushPromises();
    expect(pap.registrar).toHaveBeenCalledWith(expect.objectContaining({ prox_fecha: '2026-12-03' }));
  });

  it('Volver, borrar la fecha y pasar a Interesado vuelve a sugerir mañana', async () => {
    const { w } = await abrir(catalogo(1));
    await boton(w, 'Volver').trigger('click');
    await flushPromises();
    await w.find('input[type="date"]').setValue('');
    await boton(w, 'Interesado').trigger('click');
    await flushPromises();
    expect(w.find('input[type="date"]').element.value).toBe('2026-11-26');
  });

  it('no pisa una fecha ya puesta al cambiar de resultado', async () => {
    const { w } = await abrir(catalogo(1));
    await boton(w, 'Volver').trigger('click');
    await flushPromises();
    await w.find('input[type="date"]').setValue('2026-12-10');
    await boton(w, 'Interesado').trigger('click');
    await flushPromises();
    expect(w.find('input[type="date"]').element.value).toBe('2026-12-10');
  });

  it('"Sin respuesta" marcada y sin fecha avisa y no toca nombre ni teléfono', async () => {
    const { w, pap, toast } = await abrir(catalogo(1));
    await w.findAll('input')[0].setValue('');
    await boton(w, 'Sin respuesta').trigger('click');
    await flushPromises();
    expect(toast.warning).toHaveBeenCalled();
    expect(pap.registrar).not.toHaveBeenCalled();
    expect(w.findAll('input')[0].element.value).toBe('');
    expect(w.findAll('input')[1].element.value).toBe('');
  });

  it('"Sin respuesta" marcada con fecha ya puesta registra', async () => {
    const { w, pap } = await abrir(catalogo(1));
    await boton(w, 'Interesado').trigger('click');
    await flushPromises();
    await w.find('input[type="date"]').setValue('2026-12-04');
    await boton(w, 'Sin respuesta').trigger('click');
    await flushPromises();
    expect(pap.registrar).toHaveBeenCalledWith(expect.objectContaining({ resultado_codigo: 'SIN_RESPUESTA', prox_fecha: '2026-12-04' }));
  });

  it('los títulos cambian: Volver o seguimiento', async () => {
    const { w } = await abrir(catalogo(1));
    await boton(w, 'Volver').trigger('click');
    expect(w.text()).toContain('¿Cuándo debes volver?');
    await boton(w, 'Interesado').trigger('click');
    expect(w.text()).toContain('¿Cuándo es el seguimiento?');
    expect(w.text()).not.toContain('¿Cuándo debes volver?');
  });

  it('"Guardar y nuevo" limpia la fecha', async () => {
    const { w } = await abrir(catalogo(1));
    await w.findAll('input')[0].setValue('Ana');
    await w.findAll('input')[1].setValue('555');
    await boton(w, 'Interesado').trigger('click');
    await flushPromises();
    await w.find('input[type="date"]').setValue('2026-12-05');
    await boton(w, 'Guardar y nuevo').trigger('click');
    await flushPromises();
    expect(w.find('input[type="date"]').exists()).toBe(false);
    await boton(w, 'Interesado').trigger('click');
    await flushPromises();
    expect(w.find('input[type="date"]').element.value).toBe('2026-11-26');
  });
});
