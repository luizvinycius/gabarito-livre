import { describe, expect, it } from 'vitest'
import {
  corrigir,
  distribuir,
  formatarNota,
  gabaritoCompleto,
  gabaritoVazio,
  lerNumero,
  redimensionar,
  soma,
} from './correcao'

const gabarito = { letras: [...'BABCDACC'], valores: Array(8).fill(1) }

describe('corrigir', () => {
  it('conta acertos e soma a nota', () => {
    const c = corrigir(gabarito, [...'BABCDACC'])
    expect(c.acertos).toBe(8)
    expect(c.nota).toBe(8)
    expect(c.total).toBe(8)
    expect(c.pendentes).toBe(0)
  })

  it('usa o valor de cada questão', () => {
    const g = { ...gabarito, valores: [0.75, 1, 1, 1, 1, 1, 1.25, 2] }
    const c = corrigir(g, [...'BAXXXXCC'])
    expect(c.acertos).toBe(4)
    expect(c.nota).toBe(0.75 + 1 + 1.25 + 2)
  })

  it('deixa as dúvidas pendentes até o professor confirmar', () => {
    const c = corrigir(gabarito, [...'?ABC*ACC'])
    expect(c.pendentes).toBe(2)
    expect(c.acertos).toBe(6)
    expect(c.questoes[0].final).toBeNull()
    expect(c.questoes[0].certa).toBe(false)
  })

  it('aplica as confirmações', () => {
    // Q1 confirmada como B (certa); Q5 confirmada como inválida (X)
    const c = corrigir(gabarito, [...'?ABC*ACC'], { 0: 'B', 4: 'X' })
    expect(c.pendentes).toBe(0)
    expect(c.acertos).toBe(7)
    expect(c.questoes[4].final).toBe('X')
  })

  it('deixa o professor corrigir uma questão lida sem dúvida', () => {
    const c = corrigir(gabarito, [...'BABCDACC'], { 0: 'E' })
    expect(c.questoes[0].final).toBe('E')
    expect(c.questoes[0].alterada).toBe(true)
    expect(c.questoes[1].alterada).toBe(false)
    expect(c.acertos).toBe(7)
  })

  it('não marca como alterada a confirmação de uma dúvida', () => {
    const c = corrigir(gabarito, [...'?ABCDACC'], { 0: 'B' })
    expect(c.questoes[0].alterada).toBe(false)
  })

  it('trata tabela não encontrada como tudo em dúvida', () => {
    const c = corrigir(gabarito, [])
    expect(c.pendentes).toBe(8)
    expect(c.nota).toBe(0)
  })
})

describe('gabarito', () => {
  it('só fica completo com todas as letras', () => {
    const g = gabaritoVazio(3)
    expect(gabaritoCompleto(g)).toBe(false)
    expect(gabaritoCompleto({ ...g, letras: ['A', 'B', 'C'] })).toBe(true)
  })

  it('mantém o que foi preenchido ao mudar o número de questões', () => {
    const g = { letras: ['A', 'B', 'C'], valores: [1, 1, 2] }
    expect(redimensionar(g, 2)).toEqual({ letras: ['A', 'B'], valores: [1, 1] })
    expect(redimensionar(g, 5)).toEqual({ letras: ['A', 'B', 'C', '', ''], valores: [1, 1, 2, 2, 2] })
  })

  it('distribui um total sem perder centavos', () => {
    const g = distribuir(gabaritoVazio(3), 10)
    expect(g.valores).toEqual([3.33, 3.33, 3.34])
    expect(soma(g.valores)).toBe(10)
    expect(distribuir(gabaritoVazio(8), 4).valores).toEqual(Array(8).fill(0.5))
  })
})

describe('números', () => {
  it('soma sem erro de ponto flutuante', () => {
    expect(soma([0.1, 0.2])).toBe(0.3)
  })

  it('formata em pt-BR', () => {
    expect(formatarNota(7.5)).toBe('7,5')
    expect(formatarNota(8)).toBe('8')
    expect(formatarNota(3.333)).toBe('3,33')
  })

  it('lê vírgula ou ponto', () => {
    expect(lerNumero('0,75')).toBe(0.75)
    expect(lerNumero('1.5')).toBe(1.5)
    expect(lerNumero('')).toBeNaN()
    expect(lerNumero('abc')).toBeNaN()
    expect(lerNumero('-1')).toBeNaN()
  })
})
