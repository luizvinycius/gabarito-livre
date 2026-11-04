import { describe, expect, it } from 'vitest'
import { FOLGA_QUADRO, quadroNoVideo, tamanhoVisor } from './visor'

// vídeo em pé de um celular (1080 × 1920) e a área livre da tela do
// iPhone 11 no Safari, entre a barra de cima e os botões
const VIDEO = { w: 1080, h: 1920 }
const AREA = { w: 414, h: 540 }

describe('quadroNoVideo', () => {
  it('centraliza o quadro e usa 84% da largura do vídeo', () => {
    const q = quadroNoVideo(8, VIDEO)
    expect(q.w).toBeCloseTo(0.84)
    expect(q.x).toBeCloseTo(0.08)
    // (8 + 1 linhas) × 0,11 × largura, em fração da altura
    expect(q.h).toBeCloseTo((0.84 * 9 * 0.11 * 1080) / 1920)
    expect(q.y).toBeCloseTo((1 - q.h) / 2)
  })

  it('estreita o quadro quando a tabela não cabe na altura do vídeo', () => {
    const q = quadroNoVideo(30, VIDEO)
    expect(q.h).toBeCloseTo(0.9)
    expect(q.w).toBeLessThan(0.84)
    // a proporção da tabela continua a mesma
    expect((q.h * VIDEO.h) / (q.w * VIDEO.w)).toBeCloseTo(31 * 0.11)
  })

  it('não tem quadro antes de saber o tamanho do vídeo', () => {
    expect(quadroNoVideo(8, null)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })
})

describe('tamanhoVisor', () => {
  it('cobre a área inteira, como a câmera do celular, quando o quadro cabe', () => {
    const quadro = quadroNoVideo(10, VIDEO)
    const v = tamanhoVisor(AREA, VIDEO, quadro)
    expect(v.w).toBeGreaterThanOrEqual(AREA.w - 0.01)
    expect(v.h).toBeGreaterThanOrEqual(AREA.h - 0.01)
    expect(v.w / v.h).toBeCloseTo(VIDEO.w / VIDEO.h)
  })

  it('nunca deixa o quadro sair da área visível', () => {
    for (const n of [1, 5, 10, 20, 30]) {
      const quadro = quadroNoVideo(n, VIDEO)
      for (const area of [AREA, { w: 360, h: 420 }, { w: 800, h: 300 }, { w: 1280, h: 600 }]) {
        const v = tamanhoVisor(area, VIDEO, quadro)
        expect(quadro.w * v.w).toBeLessThanOrEqual(area.w * FOLGA_QUADRO + 0.01)
        expect(quadro.h * v.h).toBeLessThanOrEqual(area.h * FOLGA_QUADRO + 0.01)
      }
    }
  })

  it('com a tabela comprida, amplia só até o quadro encostar na folga', () => {
    const quadro = quadroNoVideo(30, VIDEO)
    const area = { w: 414, h: 300 }
    const v = tamanhoVisor(area, VIDEO, quadro)
    expect(quadro.h * v.h).toBeCloseTo(area.h * FOLGA_QUADRO)
    // não cobre a largura: sobra preto dos lados, mas a tabela inteira aparece
    expect(v.w).toBeLessThan(area.w)
  })

  it('vale para a webcam deitada do computador', () => {
    const webcam = { w: 1280, h: 720 }
    const quadro = quadroNoVideo(8, webcam)
    const area = { w: 1200, h: 600 }
    const v = tamanhoVisor(area, webcam, quadro)
    expect(v.w / v.h).toBeCloseTo(1280 / 720)
    expect(quadro.h * v.h).toBeLessThanOrEqual(area.h * FOLGA_QUADRO + 0.01)
  })

  it('não tem tamanho antes de medir a área ou o vídeo', () => {
    const quadro = quadroNoVideo(8, VIDEO)
    expect(tamanhoVisor({ w: 0, h: 0 }, VIDEO, quadro)).toEqual({ w: 0, h: 0 })
    expect(tamanhoVisor(AREA, null, quadro)).toEqual({ w: 0, h: 0 })
  })
})
