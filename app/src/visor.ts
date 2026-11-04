// Geometria da câmera: onde fica o quadro-guia no vídeo e de que tamanho o
// vídeo aparece na tela.
//
// A câmera ocupa a tela inteira. O vídeo é ampliado para cobrir a área entre
// a barra de cima e os botões (como a câmera do celular), cortando as
// bordas, mas nunca a ponto de o quadro sair da área visível. O quadro fica
// no centro do vídeo e o vídeo no centro da área, então o corte é simétrico.
// O recorte da leitura sai do vídeo inteiro, não do que aparece na tela.

export type Tamanho = { w: number; h: number }
// em frações do vídeo (0 a 1)
export type Quadro = { x: number; y: number; w: number; h: number }

// Proporções da tabela da Univag. A altura aparente de cada linha muda muito
// com o ângulo da câmera (nas fotos de teste, de 6% a 9% da largura da
// tabela); o quadro usa um valor alto para a tabela nunca ficar cortada,
// e a folga vertical do recorte cobre o resto.
// TODO: recalibrar com o modelo oficial quando chegar (seção 6).
export const ALTURA_LINHA = 0.11
export const LINHAS_CABECALHO = 1
// Largura do quadro em relação à largura do vídeo.
const LARGURA_QUADRO = 0.84
// Altura máxima do quadro em relação à altura do vídeo.
const ALTURA_MAXIMA = 0.9
// Fração da área visível que o quadro pode ocupar: sobra uma borda escura em
// volta para o professor ver que a tabela está dentro.
export const FOLGA_QUADRO = 0.94

const SEM_QUADRO: Quadro = { x: 0, y: 0, w: 0, h: 0 }
const SEM_TAMANHO: Tamanho = { w: 0, h: 0 }

// Quadro centralizado no vídeo. A altura acompanha o número de questões; se
// a tabela ficar alta demais para o vídeo, o quadro estreita para caber.
export function quadroNoVideo(nQuestoes: number, video: Tamanho | null): Quadro {
  if (!video || !video.w || !video.h) return SEM_QUADRO
  const proporcao = (nQuestoes + LINHAS_CABECALHO) * ALTURA_LINHA
  let w = LARGURA_QUADRO
  let h = (w * proporcao * video.w) / video.h
  if (h > ALTURA_MAXIMA) {
    w *= ALTURA_MAXIMA / h
    h = ALTURA_MAXIMA
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

// Tamanho do vídeo na tela (em px), com a proporção do vídeo: o maior entre
// "mostrar o vídeo inteiro" e "cobrir a área sem o quadro sair dela".
export function tamanhoVisor(area: Tamanho, video: Tamanho | null, quadro: Quadro): Tamanho {
  if (!video || !video.w || !video.h || !area.w || !area.h || !quadro.w || !quadro.h) return SEM_TAMANHO
  const razao = video.w / video.h
  const conter = Math.min(area.h, area.w / razao)
  const cobrir = Math.max(area.h, area.w / razao)
  const cabeQuadro = Math.min((area.h * FOLGA_QUADRO) / quadro.h, (area.w * FOLGA_QUADRO) / (quadro.w * razao))
  const altura = Math.max(conter, Math.min(cobrir, cabeQuadro))
  return { w: altura * razao, h: altura }
}
