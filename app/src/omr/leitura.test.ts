import { describe, expect, it } from 'vitest'
import type { Circulo } from './protocolo'
import {
  type Grade,
  agruparLinhas,
  anguloDaGrade,
  decidir,
  gradeSuspeita,
  lerGrade,
  pistaDoLado,
} from './leitura'

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
    // a segunda passa da base, mas menos de 0,4 do vão
    expect(decidir([0.85, 0.2, 0.4, 0.2, 0.22])).toBe('A')
  })

  it('pergunta quando a segunda marcação é forte demais para rasura', () => {
    // foto GS-02, questão 6: B e D marcadas, D mais fraca (0,5 do vão)
    expect(decidir([0.2, 0.51, 0.2, 0.38, 0.25])).toBe('?')
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

  it('acompanha a folha arqueada', () => {
    // o meio de cada linha sobe 16 px em relação à A e à E (r-02): a
    // homografia sozinha errava ~8 px nas pontas
    const tabela = grade(8).map((linha) => linha.map((c, k) => ({ ...c, y: c.y - 16 * (1 - ((k - 2) / 2) ** 2) })))
    const g = agruparLinhas(tabela.flat(), 8, anelDa(tabela))!
    g.linhas.forEach((linha, l) =>
      linha.forEach((c, k) => expect(Math.hypot(c.x - tabela[l][k].x, c.y - tabela[l][k].y)).toBeLessThan(2)),
    )
    expect(gradeSuspeita(g)).toBe(false)
  })

  for (const [coluna, nome] of [
    [4, 'E (borda do papel enrolada, r-07)'],
    [0, 'A (a coluna que falta nas cadeias é a da esquerda)'],
  ] as const) {
    it(`acha a coluna ${nome} deslocada 0,4 linha`, () => {
      // a coluna deslocada não entra em nenhuma cadeia (desnível de 30 px)
      const tabela = grade(8).map((linha) => linha.map((c, k) => (k === coluna ? { ...c, y: c.y + 30 } : c)))
      const g = agruparLinhas(tabela.flat(), 8, anelDa(tabela))!
      g.linhas.forEach((linha, l) =>
        linha.forEach((c, k) => expect(Math.hypot(c.x - tabela[l][k].x, c.y - tabela[l][k].y)).toBeLessThan(3)),
      )
      expect(gradeSuspeita(g)).toBe(false)
    })
  }

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

  it('acompanha a perspectiva de uma foto inclinada', () => {
    // as linhas de baixo ficam mais perto da câmera: maiores e mais
    // espaçadas (uma grade afim escorrega mais de 5 px nas pontas)
    const w = (y: number) => 1 - 0.0004 * (y - 400)
    const tabela = grade(8).map((linha) =>
      linha.map(({ x, y, r }) => ({ x: 500 + (x - 500) / w(y), y: 400 + (y - 400) / w(y), r: r / w(y) })),
    )
    const g = agruparLinhas(tabela.flat(), 8, anelDa(tabela))!
    expect(g.aneis.every((a) => a === 5)).toBe(true)
    g.linhas.forEach((linha, l) =>
      linha.forEach((c, k) => {
        expect(Math.hypot(c.x - tabela[l][k].x, c.y - tabela[l][k].y)).toBeLessThan(1)
      }),
    )
    // o raio acompanha: as bolinhas de baixo são maiores
    expect(g.linhas[7][2].r).toBeGreaterThan(g.linhas[0][2].r * 1.2)
  })

  it('conta as bolinhas achatadas como detectadas, sem montar a grade com elas', () => {
    // a primeira linha (longe da câmera) só tem bolinhas achatadas
    const tabela = grade(8)
    const detectados = tabela.flatMap((linha, l) => linha.map((c) => ({ ...c, redondo: l > 0 })))
    const g = agruparLinhas(detectados, 8, anelDa(tabela))!
    expect(g.detectadas[0]).toBe(5)
    expect(g.colunas).toEqual([8, 8, 8, 8, 8, 0, 0])
  })

  it('conta linhas a mais mesmo com anel fraco (foto de longe)', () => {
    // tabela de 10 linhas, gabarito de 8, todas as linhas com anel 3,75:
    // sem contar as fracas, o bloco ficaria onde caiu e não avisaria
    const tabela = grade(10)
    const fraco = (p: Circulo) => {
      const nota = anelDa(tabela)(p)
      return nota === null ? null : nota * 0.75
    }
    const g = agruparLinhas(tabela.flat(), 8, fraco)!
    expect(g.linhas[0][0].y).toBeCloseTo(tabela[0][0].y, 0)
    expect(g.linhasExtras).toBe(2)
  })
})

describe('gradeSuspeita', () => {
  const base: Grade = {
    linhas: [],
    aneis: [5, 5, 5, 5],
    detectadas: [5, 5, 5, 5],
    colunas: [4, 4, 4, 4, 4, 0, 0],
    linhasExtras: 0,
    raio: 17,
  }

  it('aceita a tabela com anel alto', () => {
    expect(gradeSuspeita(base)).toBe(false)
  })

  it('aceita anel fraco numa linha com bolinhas detectadas em todas as colunas', () => {
    // foto de longe: bolinhas pequenas e impressão clara
    expect(gradeSuspeita({ ...base, aneis: [3.6, 4.0, 5, 5], detectadas: [4, 4, 5, 5] })).toBe(false)
  })

  it('não aceita anel fraco com uma coluna sem bolinhas (grade deslocada)', () => {
    const aneis = [3.9, 3.9, 3.9, 3.9]
    const detectadas = [4, 4, 4, 4]
    expect(gradeSuspeita({ ...base, aneis, detectadas, colunas: [0, 4, 4, 4, 4, 0, 0] })).toBe(true)
  })

  it('não aceita anel fraco com bolinhas redondas na coluna ao lado do bloco (grade deslocada)', () => {
    // a coluna "A" do bloco caiu nos números da coluna Questão; a E da
    // tabela ficou de fora
    const aneis = [3.9, 3.9, 3.9, 3.9]
    const detectadas = [4, 4, 4, 4]
    expect(gradeSuspeita({ ...base, aneis, detectadas, colunas: [4, 4, 4, 4, 4, 0, 4] })).toBe(true)
  })

  it('não aceita anel abaixo do mínimo fraco', () => {
    expect(gradeSuspeita({ ...base, aneis: [3.3, 5, 5, 5], detectadas: [3, 5, 5, 5] })).toBe(true)
  })

  it('aceita anel borrado numa tabela pequena com quase todas as bolinhas detectadas', () => {
    // f08 e f20 do grupo: tabela de ~130 px lida com a imagem 2x maior
    expect(gradeSuspeita({ ...base, aneis: [2.7, 3.2, 3.3, 3.1], detectadas: [5, 4, 5, 5] })).toBe(false)
    expect(gradeSuspeita({ ...base, aneis: [2.4, 3.2, 3.3, 3.1], detectadas: [5, 4, 5, 5] })).toBe(true)
  })
})

describe('anguloDaGrade', () => {
  it('acha a inclinação da grade, de -45° a 45°', () => {
    for (const graus of [0, 20, -30, 70]) {
      const a = (graus * Math.PI) / 180
      const girada = grade(8)
        .flat()
        .map(({ x, y, r }) => ({
          x: 500 + (x - 500) * Math.cos(a) - (y - 600) * Math.sin(a),
          y: 600 + (x - 500) * Math.sin(a) + (y - 600) * Math.cos(a),
          r,
        }))
      const esperado = ((((graus + 45) % 90) + 90) % 90) - 45 // 70° = -20° + 90°
      expect((anguloDaGrade(girada) * 180) / Math.PI).toBeCloseTo(esperado, 5)
    }
  })
})

// Folha girada de "graus" em volta de (500, 700): posições na foto e a
// escuridão da foto, com as linhas que separam as questões passando pela
// coluna Questão (do lado da A) quando linhasDaQuestao.
function folhaGirada(graus: number, linhasDaQuestao = true) {
  const a = (graus * Math.PI) / 180
  const naFoto = ({ x, y, r }: Circulo): Circulo => ({
    x: 500 + (x - 500) * Math.cos(a) - (y - 700) * Math.sin(a),
    y: 700 + (x - 500) * Math.sin(a) + (y - 700) * Math.cos(a),
    r,
  })
  const tabela = grade(8, { x0: 420, y0: 420, dx: 60, dy: 52, r: 14 })
  const foto = tabela.map((linha) => linha.map(naFoto))
  const escuro = (px: number, py: number) => {
    // volta para a folha
    const x = 500 + (px - 500) * Math.cos(a) + (py - 700) * Math.sin(a)
    const y = 700 - (px - 500) * Math.sin(a) + (py - 700) * Math.cos(a)
    const naColuna = x > 420 - 2.75 * 60 && x < 420 - 0.5 * 60
    const vao = (y - 420) / 52 - 0.5
    const naLinha = vao > -0.5 && vao < 7 && Math.abs(vao - Math.round(vao)) * 52 < 1.5
    return linhasDaQuestao && naColuna && naLinha ? 0.6 : 0
  }
  return { tabela, foto, escuro }
}

describe('pistaDoLado', () => {
  it('é positiva com a folha em pé e negativa de cabeça para baixo', () => {
    const { foto, escuro } = folhaGirada(0)
    expect(pistaDoLado(foto, escuro)).toBeGreaterThan(0.3)
    const invertida = [...foto].reverse().map((linha) => [...linha].reverse())
    expect(pistaDoLado(invertida, escuro)).toBeLessThan(-0.3)
  })

  it('ignora a textura da mesa em volta da folha', () => {
    // a folha acaba logo depois da coluna E; dali em diante, madeira escura
    // com veios na direção das linhas
    const { foto, escuro } = folhaGirada(0)
    const bordaDoPapel = 420 + 4 * 60 + 60
    const naMesa = (px: number, py: number) => {
      const e = escuro(px, py)
      return px > bordaDoPapel ? 0.2 + 0.5 * (Math.trunc(py / 7) % 2) : e
    }
    const fundo = (px: number) => (px > bordaDoPapel ? 80 : 220)
    expect(pistaDoLado(foto, naMesa)).toBeLessThan(0.1) // sem olhar o fundo, a mesa empata
    expect(pistaDoLado(foto, naMesa, fundo)).toBeGreaterThan(0.3)
    const invertida = [...foto].reverse().map((linha) => [...linha].reverse())
    expect(pistaDoLado(invertida, naMesa, fundo)).toBeLessThan(-0.3)
  })
})

describe('lerGrade', () => {
  for (const graus of [90, 180, 270, 35]) {
    it(`lê a folha girada de ${graus}° com a questão 1 e a coluna A no lugar certo`, () => {
      const { foto, escuro } = folhaGirada(graus)
      const { grade: g, ladoIncerto } = lerGrade(foto.flat(), 8, (x, y) => anelDa(foto)({ x, y, r: 14 }), escuro, true)
      expect(ladoIncerto).toBe(false)
      expect(Math.hypot(g!.linhas[0][0].x - foto[0][0].x, g!.linhas[0][0].y - foto[0][0].y)).toBeLessThan(1)
      expect(Math.hypot(g!.linhas[7][4].x - foto[7][4].x, g!.linhas[7][4].y - foto[7][4].y)).toBeLessThan(1)
    })
  }

  it('avisa quando não dá para saber o lado da folha', () => {
    const { foto, escuro } = folhaGirada(90, false)
    const { grade: g, ladoIncerto } = lerGrade(foto.flat(), 8, (x, y) => anelDa(foto)({ x, y, r: 14 }), escuro, true)
    expect(g).not.toBeNull()
    expect(ladoIncerto).toBe(true)
  })

  it('sem procurar, lê a foto como está', () => {
    const { foto, escuro } = folhaGirada(0, false)
    const { grade: g, ladoIncerto } = lerGrade(foto.flat(), 8, (x, y) => anelDa(foto)({ x, y, r: 14 }), escuro, false)
    expect(ladoIncerto).toBe(false)
    expect(g!.linhas[0][0].x).toBeCloseTo(foto[0][0].x, 0)
  })
})
