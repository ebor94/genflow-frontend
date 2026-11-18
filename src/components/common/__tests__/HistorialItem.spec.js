import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import HistorialItem from '@/components/common/HistorialItem.vue';

const base = { gest_id: 1, gest_fecha_hora: '2026-11-18T10:40:00', asesor: { usr_nombre: 'Carmen', usr_apellido: 'Contreras' } };

describe('HistorialItem', () => {
  it('muestra 🏛️ y "Visita en sala" para el canal visita_sala', () => {
    const w = mount(HistorialItem, { props: { gestion: { ...base, gest_canal: 'visita_sala' } } });
    expect(w.text()).toContain('🏛️');
    expect(w.text()).toContain('Visita en sala');
  });

  it('no lo muestra para una llamada', () => {
    const w = mount(HistorialItem, { props: { gestion: { ...base, gest_canal: 'llamada' } } });
    expect(w.text()).toContain('📞');
    expect(w.text()).not.toContain('Visita en sala');
  });
});
