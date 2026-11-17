import { describe, it, expect } from 'vitest';
import { separarNombre } from '@/utils/nombres';

describe('separarNombre', () => {
  it.each([
    ['PATRICIA SANTAFE', { nombre: 'PATRICIA', apellido: 'SANTAFE' }],
    ['ANA MARIA GOMEZ', { nombre: 'ANA', apellido: 'MARIA GOMEZ' }],
    ['ANA MARIA GOMEZ PEREZ', { nombre: 'ANA MARIA', apellido: 'GOMEZ PEREZ' }],
    ['  CAMILO   OMAÑA  ', { nombre: 'CAMILO', apellido: 'OMAÑA' }],
    ['MONONOMBRE', { nombre: 'MONONOMBRE', apellido: '' }],
    ['', { nombre: '', apellido: '' }]
  ])('%p', (entrada, esperado) => {
    expect(separarNombre(entrada)).toEqual(esperado);
  });
});
