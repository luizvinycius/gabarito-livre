import { afterEach, describe, expect, it, vi } from 'vitest'
import { NOTAS, guardarSom, somLigado, tocar, tomDaLeitura } from './som'

function leitura(letras: string, { cortada = false, lado = false, extras = 0 } = {}) {
  return {
    respostas: [...letras].map((letra) => ({ letra })),
    tabelaCortada: cortada,
    ladoIncerto: lado,
    linhasExtras: extras,
  }
}

function memoria() {
  const dados = new Map<string, string>()
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tomDaLeitura', () => {
  it('toca o som de certo quando todas as questões foram lidas sem dúvida', () => {
    expect(tomDaLeitura(leitura('ABCDEABC'), 8)).toBe('certo')
  })

  it('pede para conferir com questão em branco, incerta ou com duas marcadas', () => {
    expect(tomDaLeitura(leitura('ABC?EABC'), 8)).toBe('conferir')
    expect(tomDaLeitura(leitura('ABC*EABC'), 8)).toBe('conferir')
  })

  it('pede para conferir quando a tabela não foi achada ou tem outro tamanho', () => {
    expect(tomDaLeitura(leitura(''), 8)).toBe('conferir')
    expect(tomDaLeitura(leitura('ABCDEA'), 8)).toBe('conferir')
    expect(tomDaLeitura(null, 8)).toBe('conferir')
  })

  it('pede para conferir com tabela cortada, lado incerto ou linhas a mais', () => {
    expect(tomDaLeitura(leitura('ABCDEABC', { cortada: true }), 8)).toBe('conferir')
    expect(tomDaLeitura(leitura('ABCDEABC', { lado: true }), 8)).toBe('conferir')
    expect(tomDaLeitura(leitura('ABCDEABC', { extras: 2 }), 8)).toBe('conferir')
  })
})

describe('NOTAS', () => {
  it('o som de certo sobe e o de conferir desce', () => {
    const [a, b] = NOTAS.certo
    expect(b.freq).toBeGreaterThan(a.freq)
    const [c, d] = NOTAS.conferir
    expect(d.freq).toBeLessThan(c.freq)
  })

  it('os dois sons são curtos (menos de meio segundo)', () => {
    for (const notas of Object.values(NOTAS)) {
      const fim = Math.max(...notas.map((n) => n.inicio + n.duracao))
      expect(fim).toBeLessThan(0.5)
    }
  })
})

describe('preferência do som', () => {
  it('vem ligado por padrão', () => {
    vi.stubGlobal('localStorage', memoria())
    expect(somLigado()).toBe(true)
  })

  it('lembra quando o professor desliga e liga de novo', () => {
    vi.stubGlobal('localStorage', memoria())
    guardarSom(false)
    expect(somLigado()).toBe(false)
    guardarSom(true)
    expect(somLigado()).toBe(true)
  })

  it('fica ligado sem acesso ao armazenamento (aba anônima)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    })
    expect(() => guardarSom(false)).not.toThrow()
    expect(somLigado()).toBe(true)
  })
})

describe('tocar', () => {
  it('não quebra num navegador sem áudio', () => {
    vi.stubGlobal('localStorage', memoria())
    expect(() => tocar('certo')).not.toThrow()
  })

  it('não toca com o som desligado', () => {
    vi.stubGlobal('localStorage', memoria())
    const criado = vi.fn()
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          criado()
        }
      },
    )
    guardarSom(false)
    tocar('certo')
    expect(criado).not.toHaveBeenCalled()
  })
})
