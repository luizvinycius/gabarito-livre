// Web Worker de módulo: carrega o OpenCV.js e roda o processamento fora da
// thread da tela.
// Porte do poc/poc_bolhas.py (seção 3.4 da documentação); os números nos
// comentários são as etapas de lá.

import * as opencv from '@techstark/opencv-js'
import type { Mensagem, Resposta, Circulo, RespostaLida } from './protocolo'
import { agruparLinhas, decidir } from './leitura'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CV = any

// O tsconfig usa a lib DOM; aqui declaramos só o que o worker usa.
const escopo = self as unknown as {
  postMessage(r: Resposta): void
  onmessage: ((e: MessageEvent<Mensagem>) => void) | null
}

let cv: CV | null = null

function responder(r: Resposta) {
  escopo.postMessage(r)
}

async function carregar() {
  // O pacote é CommonJS: o módulo vem em .default e pode ser uma Promise.
  let m: CV = (opencv as CV).default ?? opencv
  if (m instanceof Promise) m = await m
  cv = m
  responder({ tipo: 'pronto', versao: versaoOpenCV(m) })
}

function versaoOpenCV(m: CV): string {
  try {
    const info: string = m.getBuildInformation()
    return info.match(/Version control:\s*(\S+)/)?.[1] ?? 'desconhecida'
  } catch {
    return 'desconhecida'
  }
}

function processar(largura: number, altura: number, pixels: ArrayBuffer, nQuestoes: number) {
  if (!cv) throw new Error('OpenCV ainda não carregou')
  const tempos: Record<string, number> = {}
  let t = performance.now()
  const marcar = (etapa: string) => {
    const agora = performance.now()
    tempos[etapa] = agora - t
    t = agora
  }

  const rgba = new cv.Mat(altura, largura, cv.CV_8UC4)
  rgba.data.set(new Uint8Array(pixels))
  const rgb = new cv.Mat()
  const hsv = new cv.Mat()
  const cinza = new cv.Mat()
  const verm1 = new cv.Mat()
  const verm2 = new cv.Mat()
  const binaria = new cv.Mat()
  const contornos = new cv.MatVector()
  const hierarquia = new cv.Mat()
  const fundo = new cv.Mat()
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
  const limites: CV[] = []
  const faixa = (h: number, s: number, v: number) => {
    const m = new cv.Mat(altura, largura, cv.CV_8UC3, new cv.Scalar(h, s, v))
    limites.push(m)
    return m
  }

  try {
    // 2. tinta vermelha do professor vira branco
    cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB)
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV)
    cv.inRange(hsv, faixa(0, 60, 40), faixa(12, 255, 255), verm1)
    cv.inRange(hsv, faixa(155, 60, 40), faixa(180, 255, 255), verm2)
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

    // 5 a 10. estimar a grade
    const grade = agruparLinhas(unicos, nQuestoes)
    marcar('estimar grade')

    // 11. normalizar a iluminação (medianBlur grande é a etapa mais cara)
    cv.medianBlur(cinza, fundo, 61)
    marcar('normalizar iluminação')

    // 12 e 13. medir o preenchimento de cada bolinha e decidir cada linha
    const respostas: RespostaLida[] = (grade?.linhas ?? []).map((linha) => {
      const preenchimento = linha.map((c) => preenchimentoDisco(cinza.data, fundo.data, largura, altura, c))
      return { letra: decidir(preenchimento), preenchimento }
    })
    marcar('ler respostas')

    const total = Object.values(tempos).reduce((a, b) => a + b, 0)
    responder({
      tipo: 'resultado',
      tempos,
      total,
      contornos: contornos.size(),
      circulos: unicos,
      grade: grade?.linhas ?? null,
      respostas,
    })
  } finally {
    for (const m of [rgba, rgb, hsv, cinza, verm1, verm2, binaria, contornos, hierarquia, fundo, kernel, ...limites]) {
      m.delete()
    }
  }
}

// Escuridão média (0 a 1) num disco de 0,6 raio, com a iluminação normalizada
// (cinza / fundo), como o fill_ratio do protótipo.
function preenchimentoDisco(
  cinza: Uint8Array,
  fundo: Uint8Array,
  largura: number,
  altura: number,
  { x, y, r }: Circulo,
): number {
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
      const i = py * largura + px
      soma += Math.min(255, Math.trunc((cinza[i] / (fundo[i] + 1)) * 255))
      n++
    }
  }
  return n ? (255 - soma / n) / 255 : 0
}

escopo.onmessage = async (e: MessageEvent<Mensagem>) => {
  try {
    const msg = e.data
    if (msg.tipo === 'carregar') await carregar()
    else processar(msg.largura, msg.altura, msg.pixels, msg.nQuestoes)
  } catch (err) {
    responder({ tipo: 'erro', mensagem: err instanceof Error ? err.message : String(err) })
  }
}
