import { describe, expect, it } from 'vitest'
import type { Circulo } from './protocolo'
import { agruparLinhas, decidir, gradeSuspeita } from './leitura'

describe('decidir', () => {
  it('lê a letra quando uma bolinha se destaca', () => {
    expect(decidir([0.2, 0.85, 0.22, 0.2, 0.25])).toBe('B')
    expect(decidir([0.3, 0.3, 0.3, 0.3, 0.6])).toBe('E')
  })

  it('devolve ? quando nenhuma se destaca (em branco)', () => {
    expect(decidir([0.2, 0.22, 0.21, 0.2, 0.23])).toBe('?')
  })

  it('devolve ? quando o destaque fica abaixo do limite de 0,15', () => {
    // vão = 0,44 - 0,30 = 0,14
    expect(decidir([0.3, 0.3, 0.44, 0.3, 0.3])).toBe('?')
  })

  it('devolve * quando duas estão marcadas', () => {
    expect(decidir([0.85, 0.2, 0.8, 0.2, 0.22])).toBe('*')
  })

  it('não confunde uma rasura leve com duas marcadas', () => {
    // a segunda passa da base, mas menos de 0,6 do vão
    expect(decidir([0.85, 0.2, 0.4, 0.2, 0.22])).toBe('A')
  })
})

// Grade sintética: n linhas × 5 colunas, com o canto e os espaçamentos de
// uma folha a 1000 px de largura.
function grade(nLinhas: number, { x0 = 480, y0 = 400, dx = 86, dy = 74, r = 17 } = {}): Circulo[][] {
  return Array.from({ length: nLinhas }, (_, l) =>
    Array.from({ length: 5 }, (_, c) => ({ x: x0 + c * dx, y: y0 + l * dy, r })),
  )
}

// Pontuação de anel: 1 nas posições da tabela, 0 fora dela e null fora da
// imagem (1000 × 1500).
function anelDa(tabela: Circulo[][]) {
  const pontos = tabela.flat()
  return ({ x, y }: Circulo) => {
    if (x < 30 || x > 970 || y < 30 || y > 1470) return null
    return pontos.some((p) => Math.hypot(p.x - x, p.y - y) < 5) ? 1 : 0
  }
}

describe('agruparLinhas', () => {
  it('devolve null sem bolinhas', () => {
    expect(agruparLinhas([], 8, () => 1)).toBeNull()
  })

  it('reconstrói a grade completa', () => {
    const tabela = grade(8)
    const g = agruparLinhas(tabela.flat(), 8, anelDa(tabela))!
    expect(g.linhas).toHaveLength(8)
    g.linhas.forEach((linha, l) =>
      linha.forEach((c, k) => {
        expect(c.x).toBeCloseTo(tabela[l][k].x, 0)
        expect(c.y).toBeCloseTo(tabela[l][k].y, 0)
      }),
    )
    expect(g.aneis.every((a) => a === 5)).toBe(true)
  })

  it('preenche as bolinhas que não foram detectadas', () => {
    const tabela = grade(8)
    // some com a bolinha C da questão 3 e com toda a questão 1 (marcada
    // forte, por exemplo)
    const detectados = tabela.flat().filter((c, i) => i !== 2 * 5 + 2 && c.y !== tabela[0][0].y)
    const g = agruparLinhas(detectados, 8, anelDa(tabela))!
    expect(g.linhas[0][0].y).toBeCloseTo(tabela[0][0].y, 0)
    expect(g.linhas[2][2].x).toBeCloseTo(tabela[2][2].x, 0)
    expect(g.linhas[2][2].y).toBeCloseTo(tabela[2][2].y, 0)
  })

  it('ignora círculos de outro tamanho (letras, furos)', () => {
    const tabela = grade(8)
    const ruido: Circulo[] = [
      { x: 100, y: 100, r: 40 },
      { x: 200, y: 900, r: 8 },
    ]
    const g = agruparLinhas([...tabela.flat(), ...ruido], 8, anelDa(tabela))!
    expect(g.linhas[0][0].x).toBeCloseTo(tabela[0][0].x, 0)
    expect(g.raio).toBe(17)
  })

  it('avisa quando a tabela tem mais linhas que o gabarito', () => {
    // a tabela tem 10 linhas, mas o gabarito tem 8: fica com as 8 primeiras
    // e conta as 2 que sobram
    const tabela = grade(10)
    const g = agruparLinhas(tabela.flat(), 8, anelDa(tabela))!
    expect(g.linhas).toHaveLength(8)
    expect(g.linhas[0][0].y).toBeCloseTo(tabela[0][0].y, 0)
    expect(g.linhasExtras).toBe(2)
    expect(gradeSuspeita(g)).toBe(false)
  })

  it('com linhas a mais, a questão 1 é a primeira linha da tabela', () => {
    // a primeira linha tem só 3 bolinhas detectadas (menos evidência), o que
    // faria o bloco de maior evidência começar na segunda linha
    const tabela = grade(10)
    const detectados = tabela.flat().filter((_, i) => i >= 5 || i < 3)
    const g = agruparLinhas(detectados, 8, anelDa(tabela))!
    expect(g.linhas[0][0].y).toBeCloseTo(tabela[0][0].y, 0)
    expect(g.linhasExtras).toBe(2)
  })

  it('não conta linhas sem bolinhas detectadas como linhas a mais', () => {
    // modelo compacto: as linhas de "DISSERTATIVA" logo abaixo da tabela
    // tiram anel alto, mas não têm bolinhas detectadas
    const tabela = grade(10)
    const objetivas = tabela.slice(0, 8)
    const g = agruparLinhas(objetivas.flat(), 8, anelDa(tabela))!
    expect(g.linhasExtras).toBe(0)
    expect(g.detectadas.every((d) => d === 5)).toBe(true)
    expect(gradeSuspeita(g)).toBe(false)
  })

  it('marca a grade como suspeita quando a ponta do bloco não tem bolinhas', () => {
    // a questão 1 ficou fora da foto: o bloco escorrega para a linha de
    // texto de baixo, que tem anel alto mas nenhuma bolinha detectada
    const tabela = grade(10)
    const visiveis = tabela.slice(1, 8)
    const g = agruparLinhas(visiveis.flat(), 8, anelDa(tabela.slice(1)))!
    expect(g.detectadas.at(-1)).toBe(0)
    expect(gradeSuspeita(g)).toBe(true)
  })

  it('aceita uma linha do meio sem bolinhas detectadas', () => {
    const tabela = grade(8)
    const detectados = tabela.filter((_, l) => l !== 3).flat()
    const g = agruparLinhas(detectados, 8, anelDa(tabela))!
    expect(g.detectadas[3]).toBe(0)
    expect(gradeSuspeita(g)).toBe(false)
  })

  it('devolve null quando as bolinhas estão todas numa linha só', () => {
    const tabela = grade(1)
    expect(agruparLinhas(tabela.flat(), 8, anelDa(tabela))).toBeNull()
  })

  it('marca anel baixo quando a tabela está cortada', () => {
    // só 6 linhas visíveis, mas o gabarito tem 8: as linhas que faltam caem
    // fora da tabela e tiram anel 0
    const tabela = grade(6)
    const g = agruparLinhas(tabela.flat(), 8, anelDa(tabela))!
    expect(g.aneis.some((a) => a < 4.3)).toBe(true)
    expect(gradeSuspeita(g)).toBe(true)
  })

  it('aguenta uma folha um pouco torta', () => {
    const tabela = grade(8)
    const a = (3 * Math.PI) / 180
    const girada = tabela.map((linha) =>
      linha.map(({ x, y, r }) => ({
        x: 500 + (x - 500) * Math.cos(a) - (y - 600) * Math.sin(a),
        y: 600 + (x - 500) * Math.sin(a) + (y - 600) * Math.cos(a),
        r,
      })),
    )
    const g = agruparLinhas(girada.flat(), 8, anelDa(girada))!
    expect(g.aneis.every((x) => x === 5)).toBe(true)
    expect(g.linhas[7][4].x).toBeCloseTo(girada[7][4].x, 0)
    expect(g.linhas[7][4].y).toBeCloseTo(girada[7][4].y, 0)
  })
})
