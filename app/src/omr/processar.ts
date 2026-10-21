// Leitura de uma imagem com o OpenCV.js: porte do poc/poc_bolhas.py (seção
// 3.4 da documentação); os números nos comentários são as etapas de lá.
// Não depende do navegador: roda no Web Worker do app e no Node
// (scripts/avaliar.ts), para os dois medirem exatamente o mesmo código.

import type { Resposta, Circulo, RespostaLida } from './protocolo'
import { ANEL_MINIMO, agruparLinhas, decidir } from './leitura'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CV = any

// Limites de cor do inRange: são do tamanho da imagem, então são criados
// uma vez para cada tamanho e reaproveitados entre as leituras.
let limitesVermelho: { largura: number; altura: number; mats: CV[] } | null = null

function limitesDoVermelho(cv: CV, largura: number, altura: number): CV[] {
  if (limitesVermelho?.largura !== largura || limitesVermelho.altura !== altura) {
    limitesVermelho?.mats.forEach((m) => m.delete())
    const faixa = (h: number, s: number, v: number) =>
      new cv.Mat(altura, largura, cv.CV_8UC3, new cv.Scalar(h, s, v))
    limitesVermelho = {
      largura,
      altura,
      mats: [faixa(0, 60, 40), faixa(12, 255, 255), faixa(155, 60, 40), faixa(180, 255, 255)],
    }
  }
  return limitesVermelho.mats
}

export function versaoOpenCV(m: CV): string {
  try {
    const info: string = m.getBuildInformation()
    return info.match(/Version control:\s*(\S+)/)?.[1] ?? 'desconhecida'
  } catch {
    return 'desconhecida'
  }
}

export function processar(
  cv: CV,
  larguraOriginal: number,
  alturaOriginal: number,
  pixels: ArrayBuffer,
  nQuestoes: number,
  larguraAlvo: number,
): Resposta {
  const tempos: Record<string, number> = {}
  let t = performance.now()
  const marcar = (etapa: string) => {
    const agora = performance.now()
    tempos[etapa] = agora - t
    t = agora
  }

  // 1. reduzir para a largura alvo
  const original = new cv.Mat(alturaOriginal, larguraOriginal, cv.CV_8UC4)
  original.data.set(new Uint8Array(pixels))
  // Pelo fator de escala, como o cv2.resize(img, None, fx=s, fy=s) do
  // Python: passar o tamanho final arredonda a escala vertical de outro jeito
  // e muda os pixels o bastante para virar uma resposta no limite.
  const escala = larguraAlvo / larguraOriginal
  const rgba = new cv.Mat()
  cv.resize(original, rgba, new cv.Size(0, 0), escala, escala, cv.INTER_AREA)
  const largura = rgba.cols
  const altura = rgba.rows
  const rgb = new cv.Mat()
  const hsv = new cv.Mat()
  const cinza = new cv.Mat()
  const verm1 = new cv.Mat()
  const verm2 = new cv.Mat()
  const binaria = new cv.Mat()
  const contornos = new cv.MatVector()
  const hierarquia = new cv.Mat()
  const fundo = new cv.Mat()
  const pequena = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)

  try {
    // 2. tinta vermelha do professor vira branco
    const [baixo1, alto1, baixo2, alto2] = limitesDoVermelho(cv, largura, altura)
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB)
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV)
    cv.inRange(hsv, baixo1, alto1, verm1)
    cv.inRange(hsv, baixo2, alto2, verm2)
    cv.bitwise_or(verm1, verm2, verm1)
    cv.dilate(verm1, verm1, kernel)
    cv.cvtColor(rgba, cinza, cv.COLOR_RGBA2GRAY)
    cinza.setTo(new cv.Scalar(255), verm1)
    marcar('remover vermelho')

    // 3. limiar adaptativo + contornos
    cv.adaptiveThreshold(cinza, binaria, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 31, 8)
    marcar('adaptiveThreshold')
    cv.findContours(binaria, contornos, hierarquia, cv.RETR_LIST, cv.CHAIN_APPROX_NONE)
    marcar('findContours')

    // 4. filtrar círculos
    const circulos: Circulo[] = []
    for (let i = 0; i < contornos.size(); i++) {
      const c = contornos.get(i)
      const area = cv.contourArea(c)
      if (area >= 150) {
        const { center, radius } = cv.minEnclosingCircle(c)
        const per = cv.arcLength(c, true)
        const circ = per ? (4 * Math.PI * area) / (per * per) : 0
        const caixa = cv.boundingRect(c)
        const prop = caixa.width / caixa.height
        if (circ > 0.6 && prop > 0.75 && prop < 1.33 && radius > 8 && radius < 40) {
          circulos.push({ x: center.x, y: center.y, r: radius })
        }
      }
      c.delete()
    }
    circulos.sort((a, b) => b.r - a.r)
    const unicos: Circulo[] = []
    for (const c of circulos) {
      if (unicos.every((k) => (c.x - k.x) ** 2 + (c.y - k.y) ** 2 > (0.6 * k.r) ** 2)) unicos.push(c)
    }
    marcar('filtrar círculos')

    // 11. normalizar a iluminação: a mediana larga (61 px) roda numa cópia a
    // 1/4 do tamanho (15 px), que dá quase o mesmo fundo e é ~7x mais rápida
    cv.resize(cinza, pequena, new cv.Size(Math.trunc(largura / 4), Math.trunc(altura / 4)), 0, 0, cv.INTER_AREA)
    cv.medianBlur(pequena, pequena, 15)
    cv.resize(pequena, fundo, new cv.Size(largura, altura), 0, 0, cv.INTER_LINEAR)
    marcar('normalizar iluminação')

    // 5 a 10. estimar a grade
    const imagem = { cinza: cinza.data, fundo: fundo.data, largura, altura }
    const grade = agruparLinhas(unicos, nQuestoes, (c) => notaAnel(imagem, c))
    const tabelaCortada = !!grade && grade.aneis.some((a) => a < ANEL_MINIMO)
    marcar('estimar grade')

    // 12 e 13. medir o preenchimento de cada bolinha e decidir cada linha
    const respostas: RespostaLida[] = (grade?.linhas ?? []).map((linha) => {
      const preenchimento = linha.map((c) => preenchimentoDisco(imagem, c))
      return { letra: tabelaCortada ? '?' : decidir(preenchimento), preenchimento }
    })
    marcar('ler respostas')

    const total = Object.values(tempos).reduce((a, b) => a + b, 0)
    return {
      tipo: 'resultado',
      tempos,
      total,
      contornos: contornos.size(),
      circulos: unicos,
      grade: grade?.linhas ?? null,
      tabelaCortada,
      aneis: grade?.aneis ?? [],
      respostas,
    }
  } finally {
    for (const m of [original, rgba, rgb, hsv, cinza, verm1, verm2, binaria, contornos, hierarquia, fundo, pequena, kernel]) {
      m.delete()
    }
  }
}

type Imagem = { cinza: Uint8Array; fundo: Uint8Array; largura: number; altura: number }

// Escuridão (0 a 1) de um pixel com a iluminação normalizada (cinza / fundo).
function escuridao({ cinza, fundo, largura }: Imagem, px: number, py: number): number {
  const i = py * largura + px
  return (255 - Math.min(255, Math.trunc((cinza[i] / (fundo[i] + 1)) * 255))) / 255
}

// 0 a 1: quanto (x, y, r) parece uma bolinha impressa, isto é, um anel escuro
// com papel claro em volta. null se cair fora da imagem. Procura o anel numa
// vizinhança pequena (até 0,3 raio de deslocamento), porque a grade afim erra
// alguns pixels nas pontas quando há perspectiva. Igual ao ring_score do
// protótipo.
function notaAnel(img: Imagem, { x, y, r }: Circulo): number | null {
  if (x < 1.8 * r || x >= img.largura - 1.8 * r || y < 1.8 * r || y >= img.altura - 1.8 * r) return null
  let melhor = 0
  for (const dx of [-0.3, 0, 0.3]) {
    for (const dy of [-0.3, 0, 0.3]) {
      const cx = x + dx * r
      const cy = y + dy * r
      let anel = 0
      let fora = 0
      for (let k = 0; k < 24; k++) {
        const a = (2 * Math.PI * k) / 24
        const c = Math.cos(a)
        const s = Math.sin(a)
        let max = 0
        for (const f of [0.7, 0.8, 0.9, 1.0, 1.1]) {
          max = Math.max(max, escuridao(img, Math.trunc(cx + f * r * c), Math.trunc(cy + f * r * s)))
        }
        anel += max
        fora += escuridao(img, Math.trunc(cx + 1.4 * r * c), Math.trunc(cy + 1.4 * r * s))
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
