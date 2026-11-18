import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/salasApi', () => ({ salasApi: { registrarVisita: vi.fn() } }));
vi.mock('@/api/prospectosApi', () => ({ prospectosApi: { actualizarProductos: vi.fn() } }));

import { salasApi } from '@/api/salasApi';
import { prospectosApi } from '@/api/prospectosApi';
import { useConfigStore } from '@/stores/useConfigStore';
import { useToastStore } from '@/stores/useToastStore';
import { useGestionesStore } from '@/stores/useGestionesStore';
import RegistrarGestion from '@/components/crm/RegistrarGestion.vue';

const PROSPECTO = {
  prosp_id: 900, prosp_area_id: 1, prosp_grupo_id: 1,
  persona: { persona_nombre: 'Marta Gomez', persona_telefono_principal: '3001234567' },
  productos: [{ pp_prod_id: 5, pp_es_principal: 1 }]
};
const CATALOGO = {
  resultados: [{ resultado_id: 3, resultado_grupo_id: 1, resultado_activo: 1, resultado_orden: 1, resultado_nombre: 'Interesado', resultado_requiere_fecha: 0 }],
  estados: [],
  productos: [{ prod_id: 5, prod_area_id: 1, prod_activo: 1, prod_nombre: 'Osario' }]
};
const RESUMEN = {
  duenio_nombre: 'Carmen Contreras', estado_nombre: 'Contactado', prox_gestion_fecha: '2026-11-20',
  ultima_gestion: { fecha_hora: '2026-11-18T10:40:00', canal: 'llamada', resultado_nombre: 'No contesta' }
};

function factory(props = {}) {
  const pinia = createTestingPinia({ createSpy: vi.fn });
  useConfigStore(pinia).actual = CATALOGO;
  const w = mount(RegistrarGestion, {
    props: { open: true, prospecto: PROSPECTO, ...props },
    global: { plugins: [pinia], stubs: { teleport: true } }
  });
  return { w, gestiones: useGestionesStore(pinia), toast: useToastStore(pinia) };
}

async function elegirResultadoYRegistrar(w, indiceSelectResultado) {
  await w.findAll('select')[indiceSelectResultado].setValue('3');
  const boton = w.findAll('button').find((b) => b.text().trim() === 'Registrar');
  await boton.trigger('click');
  await flushPromises();
}

describe('RegistrarGestion en modo sala', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deja el canal fijo en visita en sala, sin selector ni duración', () => {
    const { w } = factory({ homenajeSalaId: 55 });
    expect(w.find('[data-testid="canal-fijo-sala"]').text()).toContain('🏛️ Visita en sala');
    expect(w.findAll('select')).toHaveLength(2); // resultado y estado
    expect(w.text()).not.toContain('Duración');
  });

  it('registra por salasApi y no por el store de gestiones', async () => {
    salasApi.registrarVisita.mockResolvedValue({ success: true, data: { gest_id: 77 } });
    const { w, gestiones } = factory({ homenajeSalaId: 55 });
    await elegirResultadoYRegistrar(w, 0);
    expect(salasApi.registrarVisita).toHaveBeenCalledWith(55, {
      gest_resultado_id: 3, gest_estado_nuevo_id: null, gest_comentario: null,
      gest_prox_fecha: null, gest_prox_hora: null
    });
    expect(gestiones.registrar).not.toHaveBeenCalled();
    expect(w.emitted('registrada')[0]).toEqual([{ gest_id: 77 }]);
  });

  it('con resumenCliente muestra el resumen y oculta los productos', async () => {
    salasApi.registrarVisita.mockResolvedValue({ success: true, data: { gest_id: 78 } });
    const { w } = factory({ homenajeSalaId: 57, resumenCliente: RESUMEN });
    const resumen = w.find('[data-testid="resumen-cliente-sala"]');
    expect(resumen.text().replace(/\s+/g, ' ')).toContain('Cliente de Carmen Contreras · Contactado');
    expect(resumen.text()).toContain('No contesta');
    expect(w.text()).not.toContain('Productos de interés');
    await elegirResultadoYRegistrar(w, 0);
    expect(prospectosApi.actualizarProductos).not.toHaveBeenCalled();
  });

  it('si el homenaje ya finalizó avisa, suelta el modo sala y cierra sin registrar', async () => {
    salasApi.registrarVisita.mockRejectedValue({ response: { data: { error: 'HOMENAJE_CERRADO', message: 'Este homenaje ya finalizó' } } });
    const { w, toast } = factory({ homenajeSalaId: 55 });
    await elegirResultadoYRegistrar(w, 0);
    expect(toast.warning).toHaveBeenCalledWith('Este homenaje ya finalizó');
    expect(w.emitted('sala-cerrada')).toHaveLength(1);
    expect(w.emitted('close')).toHaveLength(1);
    expect(w.emitted('registrada')).toBeUndefined();
  });

  it('otros errores en modo sala siguen con el aviso de error y no cierran', async () => {
    salasApi.registrarVisita.mockRejectedValue({ response: { data: { error: 'OTRO', message: 'Falla' } } });
    const { w, toast } = factory({ homenajeSalaId: 55 });
    await elegirResultadoYRegistrar(w, 0);
    expect(toast.error).toHaveBeenCalledWith('Falla');
    expect(w.emitted('sala-cerrada')).toBeUndefined();
    expect(w.emitted('close')).toBeUndefined();
  });

  it('sin props de sala funciona como siempre', async () => {
    const { w, gestiones } = factory();
    expect(w.findAll('select')).toHaveLength(3); // canal, resultado y estado
    expect(w.find('[data-testid="canal-fijo-sala"]').exists()).toBe(false);
    expect(w.text()).toContain('Productos de interés');
    await elegirResultadoYRegistrar(w, 1);
    expect(gestiones.registrar).toHaveBeenCalledWith(expect.objectContaining({
      gest_prosp_id: 900, gest_canal: 'llamada', gest_resultado_id: 3
    }));
    expect(salasApi.registrarVisita).not.toHaveBeenCalled();
  });
});
