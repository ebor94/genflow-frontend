import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { nextTick } from 'vue';
import { describe, it, expect, vi } from 'vitest';

vi.mock('vue-router', () => ({ useRoute: () => ({ meta: {}, name: 'home' }) }));

import App from '@/App.vue';
import { useAuthStore } from '@/stores/useAuthStore';
import { useJornadaObligatoriaStore } from '@/stores/useJornadaObligatoriaStore';
import { useTrackingStore } from '@/stores/useTrackingStore';

function montar() {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
  const auth = useAuthStore(pinia);
  const wrapper = mount(App, {
    global: {
      plugins: [pinia],
      stubs: {
        RouterView: true, AppHeader: true, AppSidebar: true, BottomNav: true,
        ToastContainer: true, BusquedaGlobalModal: true, ModalInicioJornadaObligatorio: true
      }
    }
  });
  return { wrapper, auth, jorn: useJornadaObligatoriaStore(pinia), tracking: useTrackingStore(pinia) };
}
const entrar = (auth, id) => { auth.accessToken = 'a'; auth.usuario = { usr_id: id }; };

describe('App: jornada al cambiar de persona', () => {
  it('sin sesión al cargar no consulta', async () => {
    const { jorn, tracking } = montar();
    await flushPromises();
    expect(jorn.chequear).not.toHaveBeenCalled();
    expect(tracking.detener).not.toHaveBeenCalled();
  });

  it('al entrar desde sin sesión reinicia y chequea con force', async () => {
    const { auth, jorn, tracking } = montar();
    entrar(auth, 1);
    await nextTick();
    expect(jorn.reset).toHaveBeenCalled();
    expect(jorn.chequear).toHaveBeenCalledWith({ force: true });
    expect(tracking.detener).toHaveBeenCalledWith({ borrarPendientes: false });
  });

  it('con la sesión ya puesta al cargar, solo chequear()', async () => {
    const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: true });
    const auth = useAuthStore(pinia);
    entrar(auth, 1);
    mount(App, { global: { plugins: [pinia], stubs: { RouterView: true, AppHeader: true, AppSidebar: true, BottomNav: true, ToastContainer: true, BusquedaGlobalModal: true, ModalInicioJornadaObligatorio: true } } });
    const jorn = useJornadaObligatoriaStore(pinia);
    expect(jorn.chequear).toHaveBeenCalledWith();
    expect(jorn.reset).not.toHaveBeenCalled();
    expect(useTrackingStore(pinia).detener).not.toHaveBeenCalled();
  });

  it('al cambiar de usuario en la misma pestaña reinicia y vuelve a preguntar', async () => {
    const { auth, jorn, tracking } = montar();
    entrar(auth, 1);
    await nextTick();
    vi.clearAllMocks();
    auth.usuario = { usr_id: 2 };
    await nextTick();
    expect(jorn.reset).toHaveBeenCalled();
    expect(tracking.detener).toHaveBeenCalledWith({ borrarPendientes: false });
    expect(jorn.chequear).toHaveBeenCalledWith({ force: true });
  });

  it('al salir reinicia y detiene sin volver a preguntar', async () => {
    const { auth, jorn, tracking } = montar();
    entrar(auth, 1);
    await nextTick();
    vi.clearAllMocks();
    auth.accessToken = null;
    await nextTick();
    expect(jorn.reset).toHaveBeenCalled();
    expect(tracking.detener).toHaveBeenCalledWith({ borrarPendientes: false });
    expect(jorn.chequear).not.toHaveBeenCalled();
  });

  it('al volver a la pestaña con sesión pregunta con force', async () => {
    const { auth, jorn } = montar();
    entrar(auth, 1);
    await nextTick();
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(jorn.chequear).toHaveBeenCalledWith({ force: true });
  });
});
