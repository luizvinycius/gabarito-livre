// Partes da leitura que rodam na tela (precisam de canvas): preparar os
// pixels para o worker e desenhar a leitura sobre a foto.

import type { Circulo, RespostaLida } from './protocolo'

// Largura para a qual a imagem é reduzida antes da leitura. Os limites de
// raio do filtro de círculos (8 a 40 px) foram ajustados para a folha
// inteira a 1000 px; o recorte do quadro-guia tem só a tabela, então usa
// uma largura menor para as bolinhas ficarem no mesmo tamanho.
export const LARGURA_FOLHA = 1000
export const LARGURA_RECORTE = 800

export type Foto = { fonte: ImageBitmap | HTMLCanvasElement; largura: number }

// Recortes salvos pelo próprio app (conjunto de teste) são lidos como
// recorte, e não como folha inteira. O avaliar.py usa a mesma regra.
export function larguraDoArquivo(nome: string) {
  return nome.startsWith('recorte-') ? LARGURA_RECORTE : LARGURA_FOLHA
}

// A folha inteira (foto da galeria) pode estar girada ou pequena na foto, e a
// leitura procura a tabela; o recorte do quadro-guia já vem em pé e no tamanho
// certo.
export function procurarNaFoto({ largura }: Foto) {
  return largura === LARGURA_FOLHA
}

// Pixels da foto com até o dobro da largura da leitura: a redução final é
// feita no worker, com o INTER_AREA do OpenCV, para dar o mesmo resultado
// do protótipo em Python.
export function pixelsParaLeitura({ fonte, largura }: Foto): ImageData {
  const fator = Math.min(1, (2 * largura) / fonte.width)
  const envio = document.createElement('canvas')
  envio.width = Math.round(fonte.width * fator)
  envio.height = Math.round(fonte.height * fator)
  const ctx = envio.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, 0, 0, envio.width, envio.height)
  return ctx.getImageData(0, 0, envio.width, envio.height)
}

// Desenha a foto no canvas, no tamanho da leitura (as coordenadas que o
// worker devolve são nesse tamanho).
export function desenharFoto(c: HTMLCanvasElement | null, { fonte, largura }: Foto) {
  if (!c) return
  c.width = largura
  c.height = Math.round((fonte.height * largura) / fonte.width)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, 0, 0, c.width, c.height)
}

// Círculos detectados em cinza fino; a grade estimada em laranja, com a
// bolinha escolhida em verde e a letra lida à esquerda de cada linha.
export function desenharLeitura(
  c: HTMLCanvasElement | null,
  circulos: Circulo[],
  grade: Circulo[][] | null,
  respostas: RespostaLida[],
) {
  const ctx = c?.getContext('2d')
  if (!ctx) return
  const circulo = ({ x, y, r }: Circulo, cor: string, espessura: number) => {
    ctx.strokeStyle = cor
    ctx.lineWidth = espessura
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.stroke()
  }
  for (const d of circulos) circulo(d, '#9e9e9e', 1)
  grade?.forEach((linha, i) => {
    const { letra } = respostas[i]
    linha.forEach((b, k) => {
      const escolhida = 'ABCDE'[k] === letra
      circulo({ ...b, r: b.r + 4 }, escolhida ? '#00c853' : '#ff9800', escolhida ? 4 : 2)
    })
    const r = linha[0].r
    ctx.font = `bold ${Math.round(r * 1.6)}px system-ui, sans-serif`
    ctx.fillStyle = letra === '?' || letra === '*' ? '#d50000' : '#1565c0'
    ctx.fillText(`${i + 1}:${letra}`, linha[0].x - 7 * r, linha[0].y + r / 2)
  })
}
