// Aquecimento do leitor: a primeira execução de cada função é bem mais lenta (o
// navegador ainda está compilando). Por isso, o worker lê folhas desenhadas
// antes de avisar que está pronto, com tudo o que uma folha de verdade usa: uma
// folha em branco não tem bolinhas e não passa pelo filtro de círculos nem pela
// grade.

import { type CV, processar } from './processar'

const LARGURA_RECORTE = 800
const ALTURA_RECORTE = 700
// Foto de 3:4 no tamanho máximo que a tela envia ao worker (imagem.ts)
const LARGURA_FOTO = 2000
const ALTURA_FOTO = 2667
const LARGURA_LEITURA_FOTO = 1000
// Leituras do recorte: o navegador só otimiza a função depois de algumas
// execuções (na página de teste, a grade caiu para o normal a partir da 3ª).
const RODADAS_RECORTE = 3

// Colunas marcadas em cada questão: uma de cada letra, uma dupla e uma em branco.
const MARCAS = [[0], [1], [2], [3], [4], [0, 2], [], [1]]
export const RESPOSTAS_DA_FOLHA = 'ABCDE*?B'

const PAPEL = 0xffffffff
const TINTA = 0xff202020

/**
 * Pixels RGBA de uma folha desenhada: a tabela de bolinhas e as linhas que
 * separam as questões, que continuam pela coluna "Questão", do lado da A (a
 * pista do lado da folha). As medidas são as de uma folha de 800 px de largura,
 * na proporção da imagem.
 */
export function folhaDeAquecimento(largura: number, altura: number): ArrayBuffer {
  const pixels = new Uint32Array(largura * altura).fill(PAPEL)
  const e = largura / 800
  const [x0, y0, dx, dy, r, anel] = [240, 100, 86, 74, 17, 3].map((v) => v * e)

  const retangulo = (xa: number, xb: number, ya: number, yb: number) => {
    for (let y = Math.round(ya); y < Math.round(yb); y++) pixels.fill(TINTA, y * largura + Math.round(xa), y * largura + Math.round(xb))
  }
  const bolinha = (cx: number, cy: number, cheia: boolean) => {
    const dentro = cheia ? 0 : (r - anel) ** 2
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = (x - cx) ** 2 + (y - cy) ** 2
        if (d >= dentro && d <= r * r) pixels[y * largura + x] = TINTA
      }
    }
  }

  for (let l = 0; l <= MARCAS.length; l++) {
    const y = y0 + (l - 0.5) * dy
    retangulo(x0 - 2.6 * dx, x0 + 4.5 * dx, y - e, y + e)
  }
  MARCAS.forEach((marcadas, l) => {
    for (let c = 0; c < 5; c++) bolinha(x0 + c * dx, y0 + l * dy, marcadas.includes(c))
  })
  return pixels.buffer
}

export function aquecer(cv: CV) {
  const recorte = folhaDeAquecimento(LARGURA_RECORTE, ALTURA_RECORTE)
  for (let i = 0; i < RODADAS_RECORTE; i++)
    processar(cv, LARGURA_RECORTE, ALTURA_RECORTE, recorte, MARCAS.length, LARGURA_RECORTE)
  // a foto passa também pela redução de uma imagem grande e pelas 4 orientações
  const foto = folhaDeAquecimento(LARGURA_FOTO, ALTURA_FOTO)
  processar(cv, LARGURA_FOTO, ALTURA_FOTO, foto, MARCAS.length, LARGURA_LEITURA_FOTO, true)
}
