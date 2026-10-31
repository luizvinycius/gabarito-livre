// Leitura de uma imagem com o OpenCV.js: porte do poc/poc_bolhas.py (seção
// 3.4 da documentação); os números nos comentários são as etapas de lá.
// Não depende do navegador: roda no Web Worker do app e no Node
// (scripts/avaliar.ts), para os dois medirem exatamente o mesmo código.

import type { Resposta, Circulo, RespostaLida } from './protocolo'
import { type Detectado, type Forma, decidir, gradeSuspeita, lerGrade } from './leitura'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CV = any

export function versaoOpenCV(m: CV): string {
  try {
    const info: string = m.getBuildInformation()
    return info.match(/Version control:\s*(\S+)/)?.[1] ?? 'desconhecida'
  } catch {
    return 'desconhecida'
  }
}

// Foto inteira escolhida da galeria (procurar): se não achar a tabela, tenta
// de novo com a imagem ESCALAS[1] vezes maior (bolinhas pequenas demais para o
// filtro de raio de 8 a 40 px). Igual ao ESCALAS do protótipo.
const ESCALAS = [1, 2]

// Largura/altura de um círculo detectado: redondo (monta a grade) entre
// PROPORCAO_RODA; achatado até PROPORCAO_MAX (e 1/PROPORCAO_MAX). Numa foto
// inclinada, as bolinhas longe da câmera viram elipses de até ~1,4.
const PROPORCAO_RODA = [0.75, 1.33]
const PROPORCAO_MAX = 1.6

type Leitura = Extract<Resposta, { tipo: 'resultado' }>

/**
 * Lê a foto. procurar: foto inteira tirada fora do app (galeria), que pode
 * estar deitada, de cabeça para baixo, girada ou pequena na foto; testa as 4
 * orientações e, se não achar a tabela, uma escala maior. As posições
 * devolvidas ficam sempre na largura alvo.
 */
export function processar(
  cv: CV,
  larguraOriginal: number,
  alturaOriginal: number,
  pixels: ArrayBuffer,
  nQuestoes: number,
  larguraAlvo: number,
  procurar = false,
): Resposta {
  const original = new cv.Mat(alturaOriginal, larguraOriginal, cv.CV_8UC4)
  try {
    original.data.set(new Uint8Array(pixels))
    let melhor: { leitura: Leitura; situacao: number } | null = null
    for (const fator of procurar ? ESCALAS : [1]) {
      const lida = lerNaEscala(cv, original, nQuestoes, larguraAlvo * fator, procurar)
      if (!melhor || lida.situacao > melhor.situacao) melhor = { ...lida, leitura: reduzir(lida.leitura, fator) }
      if (lida.situacao === 2) break
    }
    return melhor!.leitura
  } finally {
    original.delete()
  }
}

// Traz as posições lidas numa escala maior de volta para a largura alvo.
function reduzir(l: Leitura, fator: number): Leitura {
  if (fator === 1) return l
  const c = ({ x, y, r }: Circulo): Circulo => ({ x: x / fator, y: y / fator, r: r / fator })
  return { ...l, circulos: l.circulos.map(c), grade: l.grade?.map((linha) => linha.map(c)) ?? null }
}

// Lê na largura larguraAlvo. situacao: 2 = tabela lida, 1 = achou a tabela
// mas pede confirmação de tudo (cortada ou lado incerto), 0 = não achou.
function lerNaEscala(
  cv: CV,
  original: CV,
  nQuestoes: number,
  larguraAlvo: number,
  procurar: boolean,
): { leitura: Leitura; situacao: number } {
  const tempos: Record<string, number> = {}
  let t = performance.now()
  const marcar = (etapa: string) => {
    const agora = performance.now()
    tempos[etapa] = agora - t
    t = agora
  }

  // Toda Mat criada aqui entra na lista e é liberada no finally, mesmo se
  // uma função do OpenCV lançar um erro no meio.
  const mats: CV[] = []
  const nova = <T,>(m: T): T => {
    mats.push(m)
    return m
  }

  try {
    // 1. reduzir para a largura alvo
    // Pelo fator de escala, como o cv2.resize(img, None, fx=s, fy=s) do
    // Python: passar o tamanho final arredonda a escala vertical de outro jeito
    // e muda os pixels o bastante para virar uma resposta no limite.
    const escala = larguraAlvo / original.cols
    const rgba = nova(new cv.Mat())
    cv.resize(original, rgba, new cv.Size(0, 0), escala, escala, cv.INTER_AREA)
    const largura = rgba.cols
    const altura = rgba.rows
    marcar('reduzir')
    const cinza = nova(new cv.Mat())
    const binaria = nova(new cv.Mat())
    const contornos = nova(new cv.MatVector())
    const hierarquia = nova(new cv.Mat())
    const fundo = nova(new cv.Mat())
    const pequena = nova(new cv.Mat())

    // 2. converter para cinza
    cv.cvtColor(rgba, cinza, cv.COLOR_RGBA2GRAY)
    marcar('converter para cinza')

    // 3. limiar adaptativo + contornos
    cv.adaptiveThreshold(cinza, binaria, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 31, 8)
    marcar('adaptiveThreshold')
    cv.findContours(binaria, contornos, hierarquia, cv.RETR_LIST, cv.CHAIN_APPROX_NONE)
    marcar('findContours')

    // 4. filtrar círculos: os redondos montam a grade; os achatados pela
    // perspectiva só contam como bolinha detectada numa posição prevista
    const circulos: Detectado[] = []
    for (let i = 0; i < contornos.size(); i++) {
      const c = contornos.get(i)
      const area = cv.contourArea(c)
      if (area >= 150) {
        const { center, radius } = cv.minEnclosingCircle(c)
        const per = cv.arcLength(c, true)
        const circ = per ? (4 * Math.PI * area) / (per * per) : 0
        const caixa = cv.boundingRect(c)
        const prop = caixa.width / caixa.height
        if (circ > 0.6 && prop > 1 / PROPORCAO_MAX && prop < PROPORCAO_MAX && radius > 8 && radius < 40) {
          const redondo = prop > PROPORCAO_RODA[0] && prop < PROPORCAO_RODA[1]
          circulos.push({ x: center.x, y: center.y, r: radius, redondo })
        }
      }
      c.delete()
    }
    // remove duplicados (contorno interno/externo do mesmo anel): primeiro
    // entre os redondos; os achatados só entram onde não há um redondo (um
    // contorno achatado maior não apaga um redondo dentro dele)
    circulos.sort((a, b) => b.r - a.r)
    const unicos: Detectado[] = []
    for (const primeiro of [true, false]) {
      for (const c of circulos) {
        if (c.redondo === primeiro && unicos.every((k) => (c.x - k.x) ** 2 + (c.y - k.y) ** 2 > (0.6 * k.r) ** 2))
          unicos.push(c)
      }
    }
    marcar('filtrar círculos')

    // 11. normalizar a iluminação
    fundoDoPapel(cv, cinza, pequena, fundo)
    marcar('normalizar iluminação')

    // 5 a 10. estimar a grade (nas 4 orientações, se procurar)
    const imagem = { cinza: cinza.data, fundo: fundo.data, largura, altura }
    const { grade, ladoIncerto } = lerGrade(
      unicos,
      nQuestoes,
      (x, y, forma) => notaAnel(imagem, x, y, forma),
      (px, py) => (px >= 0 && px < largura && py >= 0 && py < altura ? escuridao(imagem, px, py) : null),
      procurar,
      (px, py) => imagem.fundo[py * largura + px] + 1,
    )
    const tabelaCortada = !!grade && gradeSuspeita(grade)
    marcar('estimar grade')

    // 12 e 13. medir o preenchimento de cada bolinha e decidir cada linha
    const respostas: RespostaLida[] = (grade?.linhas ?? []).map((linha) => {
      const preenchimento = linha.map((c) => preenchimentoDisco(imagem, c))
      return { letra: tabelaCortada || ladoIncerto ? '?' : decidir(preenchimento), preenchimento }
    })
    marcar('ler respostas')

    const total = Object.values(tempos).reduce((a, b) => a + b, 0)
    const leitura: Leitura = {
      tipo: 'resultado',
      tempos,
      total,
      contornos: contornos.size(),
      circulos: unicos.map(({ x, y, r }) => ({ x, y, r })),
      grade: grade?.linhas ?? null,
      tabelaCortada,
      ladoIncerto,
      linhasExtras: grade?.linhasExtras ?? 0,
      aneis: grade?.aneis ?? [],
      detectadas: grade?.detectadas ?? [],
      respostas,
    }
    return { leitura, situacao: !grade ? 0 : tabelaCortada || ladoIncerto ? 1 : 2 }
  } finally {
    for (const m of mats) m.delete()
  }
}

// Cinza do papel em volta de cada pixel (sem o +1 do light_background do
// protótipo): a mediana larga (93 px) roda numa cópia a 1/4 do tamanho
// (23 px), que dá quase o mesmo fundo e é ~7x mais rápida.
function fundoDoPapel(cv: CV, cinza: CV, pequena: CV, fundo: CV) {
  const largura = cinza.cols
  const altura = cinza.rows
  cv.resize(cinza, pequena, new cv.Size(Math.trunc(largura / 4), Math.trunc(altura / 4)), 0, 0, cv.INTER_AREA)
  cv.medianBlur(pequena, pequena, 23)
  cv.resize(pequena, fundo, new cv.Size(largura, altura), 0, 0, cv.INTER_LINEAR)
}

type Imagem = { cinza: Uint8Array; fundo: Uint8Array; largura: number; altura: number }

// Escuridão (0 a 1) de um pixel com a iluminação normalizada (cinza / fundo).
function escuridao({ cinza, fundo, largura }: Imagem, px: number, py: number): number {
  const i = py * largura + px
  return (255 - Math.min(255, Math.trunc((cinza[i] / (fundo[i] + 1)) * 255))) / 255
}

// 0 a 1: quanto (x, y) parece uma bolinha impressa, isto é, um anel escuro
// com papel claro em volta. null se cair fora da imagem. forma: a elipse que a
// bolinha ocupa na foto (numa foto inclinada, as bolinhas longe da câmera
// ficam achatadas). Procura o anel numa vizinhança pequena (até 0,3 raio de
// deslocamento), porque a grade erra alguns pixels nas pontas. Igual ao
// ring_score do protótipo.
// Amostras do notaAnel: 24 ângulos em volta da bolinha, o anel entre 0,7 e
// 1,1 do raio, o papel a 1,4 e o centro deslocado até 0,3.
const ANEL_COS = Array.from({ length: 24 }, (_, k) => Math.cos((2 * Math.PI * k) / 24))
const ANEL_SEN = Array.from({ length: 24 }, (_, k) => Math.sin((2 * Math.PI * k) / 24))
const ANEL_RAIOS = [0.7, 0.8, 0.9, 1.0, 1.1]
const ANEL_DESLOCAMENTOS = [-0.3, 0, 0.3]

function notaAnel(img: Imagem, x: number, y: number, [a, b, c, d]: Forma): number | null {
  // margem: o ponto mais longe amostrado (papel em volta, a 1,4 da elipse,
  // com o centro deslocado até 0,3); no círculo, 1,8 raio
  const ex = Math.max(1.8 * Math.hypot(a, b), 1.4 * Math.hypot(a, b) + 0.3 * (Math.abs(a) + Math.abs(b)))
  const ey = Math.max(1.8 * Math.hypot(c, d), 1.4 * Math.hypot(c, d) + 0.3 * (Math.abs(c) + Math.abs(d)))
  if (x < ex || x >= img.largura - ex || y < ey || y >= img.altura - ey) return null
  const ox = ANEL_COS.map((cos, k) => a * cos + b * ANEL_SEN[k])
  const oy = ANEL_COS.map((cos, k) => c * cos + d * ANEL_SEN[k])
  let melhor = 0
  for (const dx of ANEL_DESLOCAMENTOS) {
    for (const dy of ANEL_DESLOCAMENTOS) {
      const cx = x + dx * a + dy * b
      const cy = y + dx * c + dy * d
      let anel = 0
      let fora = 0
      for (let k = 0; k < 24; k++) {
        let max = 0
        for (const f of ANEL_RAIOS) {
          max = Math.max(max, escuridao(img, Math.trunc(cx + f * ox[k]), Math.trunc(cy + f * oy[k])))
        }
        anel += max
        fora += escuridao(img, Math.trunc(cx + 1.4 * ox[k]), Math.trunc(cy + 1.4 * oy[k]))
      }
      melhor = Math.max(melhor, anel / 24 - fora / 24)
    }
  }
  return Math.min(1, Math.max(0, melhor / 0.3))
}

// Escuridão média (0 a 1) num disco de 0,6 raio, como o fill_ratio do
// protótipo.
function preenchimentoDisco(img: Imagem, { x, y, r }: Circulo): number {
  const { largura, altura } = img
  const cx = Math.trunc(x)
  const cy = Math.trunc(y)
  const raio = Math.max(2, Math.trunc(r * 0.6))
  let soma = 0
  let n = 0
  for (let dy = -raio; dy <= raio; dy++) {
    for (let dx = -raio; dx <= raio; dx++) {
      const px = cx + dx
      const py = cy + dy
      if (dx * dx + dy * dy > raio * raio || px < 0 || py < 0 || px >= largura || py >= altura) continue
      soma += escuridao(img, px, py)
      n++
    }
  }
  return n ? soma / n : 0
}
