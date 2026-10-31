import { createRequire } from 'node:module'
import { beforeAll, describe, expect, it } from 'vitest'
import { RESPOSTAS_DA_FOLHA, aquecer, folhaDeAquecimento } from './aquecimento'
import { type CV, processar } from './processar'

// Se a folha deixar de ser lida, o aquecimento para de passar pela grade e a
// primeira folha do professor volta a sair lenta, sem nenhum outro sinal.
describe('folha do aquecimento', () => {
  let cv: CV

  beforeAll(async () => {
    // Pelo require: o pacote é CommonJS e o módulo pode ser uma Promise, e o
    // import do Vitest não aceita isso.
    cv = createRequire(import.meta.url)('@techstark/opencv-js')
    if (cv instanceof Promise) cv = await cv
  }, 60000)

  it.each([
    ['recorte da câmera', 800, 700, 800, false],
    ['foto da galeria', 2000, 2667, 1000, true],
  ])('%s é lida inteira', (_nome, largura, altura, alvo, procurar) => {
    const n = RESPOSTAS_DA_FOLHA.length
    const r = processar(cv, largura, altura, folhaDeAquecimento(largura, altura), n, alvo, procurar)
    if (r.tipo !== 'resultado') throw new Error(`resposta inesperada: ${r.tipo}`)
    expect(r.respostas.map((x) => x.letra).join('')).toBe(RESPOSTAS_DA_FOLHA)
    expect(r.tabelaCortada).toBe(false)
    expect(r.ladoIncerto).toBe(false)
    expect(r.linhasExtras).toBe(0)
  })

  it('não lança erro', () => {
    expect(() => aquecer(cv)).not.toThrow()
  })

  it('o total soma todas as etapas, inclusive a cópia e a liberação', () => {
    const r = processar(cv, 800, 700, folhaDeAquecimento(800, 700), RESPOSTAS_DA_FOLHA.length, 800)
    if (r.tipo !== 'resultado') throw new Error(`resposta inesperada: ${r.tipo}`)
    expect(Object.keys(r.tempos)).toEqual(expect.arrayContaining(['copiar foto', 'liberar memória']))
    expect(r.total).toBeCloseTo(Object.values(r.tempos).reduce((a, b) => a + b, 0))
  })
})
