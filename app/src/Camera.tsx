// Câmera ao vivo com um quadro-guia onde o professor encaixa a tabela de
// respostas. A altura do quadro acompanha o número de questões. Na captura,
// devolve só o recorte do quadro (com uma margem), para a leitura não ser
// confundida pelo cabeçalho ou pelo texto em volta da tabela.

import { useEffect, useRef, useState } from 'react'

// Proporções aproximadas da tabela da Univag, medidas nas fotos de teste:
// cada linha tem de 7,5% a 9% da largura da tabela, e o cabeçalho
// "Questão / Respostas" ocupa mais ou menos uma linha.
// TODO: recalibrar com o modelo oficial quando chegar (seção 6).
const ALTURA_LINHA = 0.085
const LINHAS_CABECALHO = 1
// Largura do quadro em relação à largura do vídeo na tela.
const LARGURA_QUADRO = 0.84
// Margem extra no recorte, em fração do tamanho do quadro, para tolerar
// uma tabela um pouco fora do lugar.
const MARGEM = 0.1

function proporcaoQuadro(nQuestoes: number) {
  return (nQuestoes + LINHAS_CABECALHO) * ALTURA_LINHA
}

type Props = {
  nQuestoes: number
  onCapturar: (recorte: HTMLCanvasElement) => void
  onFechar: () => void
}

export default function Camera({ nQuestoes, onCapturar, onFechar }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [tamanho, setTamanho] = useState<{ w: number; h: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let fluxo: MediaStream | null = null
    let cancelado = false
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      .then((f) => {
        if (cancelado) {
          f.getTracks().forEach((t) => t.stop())
          return
        }
        fluxo = f
        const v = video.current!
        v.srcObject = f
        v.onloadedmetadata = () => setTamanho({ w: v.videoWidth, h: v.videoHeight })
        return v.play()
      })
      .catch((err) => setErro(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelado = true
      fluxo?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Quadro em frações do vídeo (0 a 1). Se a tabela ficar alta demais para o
  // vídeo, reduz a largura para caber.
  const proporcao = proporcaoQuadro(nQuestoes)
  let qw = LARGURA_QUADRO
  let qh = tamanho ? (qw * proporcao * tamanho.w) / tamanho.h : 0
  if (qh > 0.9) {
    qw *= 0.9 / qh
    qh = 0.9
  }
  const qx = (1 - qw) / 2
  const qy = (1 - qh) / 2

  function capturar() {
    const v = video.current
    if (!v || !tamanho) return
    const mx = qw * MARGEM
    const my = qh * MARGEM
    const x0 = Math.max(0, qx - mx) * tamanho.w
    const y0 = Math.max(0, qy - my) * tamanho.h
    const x1 = Math.min(1, qx + qw + mx) * tamanho.w
    const y1 = Math.min(1, qy + qh + my) * tamanho.h
    const recorte = document.createElement('canvas')
    recorte.width = Math.round(x1 - x0)
    recorte.height = Math.round(y1 - y0)
    recorte.getContext('2d')!.drawImage(v, x0, y0, x1 - x0, y1 - y0, 0, 0, recorte.width, recorte.height)
    onCapturar(recorte)
  }

  return (
    <div className="camera">
      {erro ? (
        <p className="erro">
          Não consegui abrir a câmera: {erro}. Confira se o site tem permissão para usar a câmera.
        </p>
      ) : (
        <div
          className="visor"
          style={tamanho ? { aspectRatio: `${tamanho.w} / ${tamanho.h}` } : undefined}
        >
          <video ref={video} playsInline muted autoPlay />
          {tamanho && (
            <div
              className="quadro"
              style={{
                left: `${qx * 100}%`,
                top: `${qy * 100}%`,
                width: `${qw * 100}%`,
                height: `${qh * 100}%`,
              }}
            >
              <div className="cabecalho" style={{ height: `${(LINHAS_CABECALHO / (nQuestoes + LINHAS_CABECALHO)) * 100}%` }}>
                Questão · Respostas
              </div>
            </div>
          )}
        </div>
      )}
      <p className="dica">
        Encaixe a tabela de respostas ({nQuestoes} questões) dentro do quadro, com o cabeçalho na
        faixa de cima.
      </p>
      <div className="acoes">
        <button className="botao secundario" onClick={onFechar}>
          Cancelar
        </button>
        <button className="botao" disabled={!tamanho} onClick={capturar}>
          📸 Capturar
        </button>
      </div>
    </div>
  )
}
