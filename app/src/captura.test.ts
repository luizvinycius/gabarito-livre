import { describe, expect, it } from 'vitest'
import { avaliarQuadro, parada } from './captura'

function leitura(letras: string, { dx = 0, dy = 0, cortada = false, extras = 0 } = {}) {
  const grade = [...letras].map((_, l) =>
    Array.from({ length: 5 }, (_, c) => ({ x: 100 + c * 60 + dx, y: 100 + l * 50 + dy, r: 14 })),
  )
  return {
    grade,
    respostas: [...letras].map((letra) => ({ letra, preenchimento: [] })),
    tabelaCortada: cortada,
    linhasExtras: extras,
  }
}

describe('avaliarQuadro', () => {
  it('pede para segurar quando a tabela inteira está no quadro', () => {
    expect(avaliarQuadro(leitura('ABCDEABC'), 8)).toBe('segure')
  })

  it('continua procurando sem tabela ou com outro número de linhas', () => {
    expect(avaliarQuadro({ grade: null, respostas: [], tabelaCortada: false, linhasExtras: 0 }, 8)).toBe('procurando')
    expect(avaliarQuadro(leitura('ABCDEA'), 8)).toBe('procurando')
  })

  it('avisa da tabela cortada e das linhas a mais', () => {
    expect(avaliarQuadro(leitura('????????', { cortada: true }), 8)).toBe('cortada')
    expect(avaliarQuadro(leitura('ABCDEABC', { extras: 2 }), 8)).toBe('extras')
  })
})

describe('parada', () => {
  it('aceita um tremor pequeno com as mesmas letras', () => {
    expect(parada(leitura('ABCDEABC'), leitura('ABCDEABC', { dx: 3, dy: -2 }))).toBe(true)
  })

  it('recusa quando a tabela se mexeu', () => {
    expect(parada(leitura('ABCDEABC'), leitura('ABCDEABC', { dy: 8 }))).toBe(false)
  })

  it('recusa quando alguma letra mudou entre as leituras', () => {
    expect(parada(leitura('ABCDEABC'), leitura('ABCDEABD'))).toBe(false)
  })
})
