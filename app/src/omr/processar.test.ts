import { describe, expect, it } from 'vitest'
import { naFaixaDoVermelho } from './processar'

describe('naFaixaDoVermelho', () => {
  // Valores conferidos com o cv.cvtColor(RGB2HSV) e os dois cv.inRange do
  // protótipo (matiz 0-12 ou 155-180, saturação e valor a partir de 60 e 40).
  // A função inteira foi comparada com o OpenCV nas 16,7 milhões de cores.
  it.each([
    [[255, 120, 120], true], // vermelho claro da correção (H 0, S 135)
    [[255, 0, 0], true],
    [[255, 100, 0], true], // H 12
    [[255, 110, 0], false], // H 13
    [[255, 0, 216], true], // H 155
    [[255, 0, 217], false], // H 154
    [[40, 0, 0], true], // V 40
    [[39, 0, 0], false], // V 39
    [[100, 76, 76], true], // S 61
    [[100, 77, 77], false], // S 59
    [[200, 200, 200], false], // papel cinza
    [[120, 0, 200], false], // roxo: o B é o maior canal
    [[0, 0, 0], false],
    [[255, 255, 255], false],
  ])('%j → %s', ([r, g, b], esperado) => {
    expect(naFaixaDoVermelho(r, g, b)).toBe(esperado)
  })
})
