// Câmera ao vivo com um quadro-guia onde o professor encaixa a tabela de
// respostas. A altura do quadro acompanha o número de questões. Na captura,
// devolve só o recorte do quadro (com uma margem), para a leitura ter menos
// texto em volta da tabela e as bolinhas ficarem num tamanho previsível.
// O quadro é só um guia: a leitura acha a tabela dentro do recorte.
//
// Captura automática: com a câmera visível, o recorte é lido sem parar no
// worker. Quando duas leituras seguidas acham a tabela inteira, parada no
// mesmo lugar e com as mesmas letras, a folha é capturada sozinha (com a
// leitura já pronta). Depois de uma captura, só captura de novo quando a
// folha sai do quadro ou as letras mudam, para não pegar a mesma folha duas
// vezes.

import { useEffect, useRef, useState } from 'react'
import { type EstadoQuadro, avaliarQuadro, parada } from './captura'
import type { Leitura } from './omr/useLeitor'

// Proporções da tabela da Univag. A altura aparente de cada linha muda muito
// com o ângulo da câmera (nas fotos de teste, de 6% a 9% da largura da
// tabela); o quadro usa um valor alto para a tabela nunca ficar cortada,
// e a folga vertical do recorte cobre o resto.
// TODO: recalibrar com o modelo oficial quando chegar (seção 6).
const ALTURA_LINHA = 0.11
const LINHAS_CABECALHO = 1
// Largura do quadro em relação à largura do vídeo na tela.
const LARGURA_QUADRO = 0.84
// Margem extra no recorte, em fração do tamanho do quadro, para tolerar
// uma tabela fora do lugar. Na vertical é maior: deslocar para cima ou para
// baixo é o erro mais comum, e linhas de texto a mais no recorte não
// atrapalham a leitura.
const MARGEM_X = 0.1
const MARGEM_Y = 0.3
// Pausa entre uma leitura e outra na captura automática (ms): deixa o
// celular respirar sem atrasar muito a captura.
const PAUSA = 120

const CHAVE_AUTOMATICO = 'gabarito-livre:captura-automatica'

function proporcaoQuadro(nQuestoes: number) {
  return (nQuestoes + LINHAS_CABECALHO) * ALTURA_LINHA
}

const MENSAGEM: Record<EstadoQuadro, string> = {
  desligado: '',
  procurando: 'Procurando a tabela…',
  cortada: 'A tabela está saindo do quadro',
  extras: 'A tabela tem mais questões que o gabarito',
  segure: 'Segure firme…',
  troque: 'Troque a folha',
  encaixou: 'Encaixou!',
}

function automaticoSalvo() {
  try {
    return localStorage.getItem(CHAVE_AUTOMATICO) !== 'nao'
  } catch {
    return true
  }
}

type Props = {
  nQuestoes: number
  // Escondida, a câmera continua ligada para a próxima folha.
  visivel: boolean
  // Ao abrir para a próxima folha, a captura automática espera a folha
  // ser trocada; ao tirar a mesma folha de novo, não.
  exigirTroca: boolean
  // lê um recorte (o leitor do app); sem ele, não há captura automática
  analisar?: (recorte: HTMLCanvasElement) => Promise<Leitura>
  // leitura: a da captura automática, para não ler a mesma imagem de novo
  onCapturar: (recorte: HTMLCanvasElement, leitura?: Leitura) => void
  onFechar: () => void
}

export default function Camera({ nQuestoes, visivel, exigirTroca, analisar, onCapturar, onFechar }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [tamanho, setTamanho] = useState<{ w: number; h: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [automatico, setAutomatico] = useState(automaticoSalvo)
  const [estado, setEstado] = useState<EstadoQuadro>('desligado')
  const [flash, setFlash] = useState(0)
  // a captura automática está liberada (a folha da última captura já saiu)
  const armada = useRef(true)
  // letras da última captura automática (para perceber que a folha mudou)
  const ultimaCaptura = useRef<string | null>(null)

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

  // Tela sempre acesa enquanto a câmera estiver ligada (a correção inteira,
  // já que a câmera só fica escondida entre uma folha e outra): o celular
  // não apaga enquanto o professor troca as folhas. O navegador solta a
  // trava quando a aba sai da frente; ao voltar, pede de novo.
  useEffect(() => {
    let trava: WakeLockSentinel | null = null
    let ativo = true
    const pedir = async () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
      try {
        const nova = await navigator.wakeLock.request('screen')
        if (ativo) trava = nova
        else void nova.release()
      } catch {
        // sem permissão ou sem bateria: segue sem a trava
      }
    }
    void pedir()
    document.addEventListener('visibilitychange', pedir)
    return () => {
      ativo = false
      document.removeEventListener('visibilitychange', pedir)
      void trava?.release()
    }
  }, [])

  // O Safari pausa o vídeo escondido; ao mostrar de novo, retoma. Ao abrir
  // para a próxima folha, a captura automática espera a troca da folha.
  useEffect(() => {
    if (!visivel) return
    video.current?.play().catch(() => {})
    armada.current = !exigirTroca
  }, [visivel, exigirTroca])

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_AUTOMATICO, automatico ? 'sim' : 'nao')
    } catch {
      // só não fica lembrado
    }
  }, [automatico])

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

  function recortar(): HTMLCanvasElement | null {
    const v = video.current
    if (!v || !tamanho || v.readyState < 2) return null
    const mx = qw * MARGEM_X
    const my = qh * MARGEM_Y
    const x0 = Math.max(0, qx - mx) * tamanho.w
    const y0 = Math.max(0, qy - my) * tamanho.h
    const x1 = Math.min(1, qx + qw + mx) * tamanho.w
    const y1 = Math.min(1, qy + qh + my) * tamanho.h
    const recorte = document.createElement('canvas')
    recorte.width = Math.round(x1 - x0)
    recorte.height = Math.round(y1 - y0)
    recorte.getContext('2d')!.drawImage(v, x0, y0, x1 - x0, y1 - y0, 0, 0, recorte.width, recorte.height)
    return recorte
  }

  function entregar(recorte: HTMLCanvasElement, leitura?: Leitura) {
    armada.current = false
    // ao abrir de novo, não mostra o "Encaixou!" desta captura
    setEstado('procurando')
    ultimaCaptura.current = leitura ? leitura.respostas.map((r) => r.letra).join('') : null
    setFlash((n) => n + 1)
    onCapturar(recorte, leitura)
  }

  function capturar() {
    const recorte = recortar()
    if (recorte) entregar(recorte)
  }

  // As funções recortar e entregar mudam a cada render; o laço usa sempre
  // as mais novas.
  const recortarAtual = useRef(recortar)
  const entregarAtual = useRef(entregar)
  useEffect(() => {
    recortarAtual.current = recortar
    entregarAtual.current = entregar
  })

  const autoLigado = visivel && automatico && !!analisar && !!tamanho
  useEffect(() => {
    if (!autoLigado) return
    let ativo = true
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    async function laco() {
      let anterior: Leitura | null = null
      await esperar(0)
      setEstado('procurando')
      while (ativo) {
        const recorte = recortarAtual.current()
        if (!recorte) {
          await esperar(200)
          continue
        }
        let r: Leitura
        try {
          r = await analisar!(recorte)
        } catch {
          await esperar(500)
          continue
        }
        if (!ativo) return
        const avaliacao = avaliarQuadro(r, nQuestoes)
        if (avaliacao !== 'segure') {
          // sem tabela inteira no quadro: a folha anterior saiu
          if (avaliacao === 'procurando') armada.current = true
          anterior = null
          setEstado(avaliacao)
        } else {
          const letras = r.respostas.map((x) => x.letra).join('')
          if (!armada.current && letras !== ultimaCaptura.current) armada.current = true
          if (!armada.current) {
            anterior = null
            setEstado('troque')
          } else if (anterior && parada(anterior, r)) {
            setEstado('encaixou')
            navigator.vibrate?.(60)
            entregarAtual.current(recorte, r)
            return
          } else {
            anterior = r
            setEstado('segure')
          }
        }
        await esperar(PAUSA)
      }
    }
    void laco()
    return () => {
      ativo = false
    }
  }, [autoLigado, analisar, nQuestoes])
  const situacao: EstadoQuadro = autoLigado ? estado : 'desligado'

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
              className={`quadro estado-${situacao}`}
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
          {situacao !== 'desligado' && (
            <div className={`situacao estado-${situacao}`} role="status">
              {MENSAGEM[situacao]}
            </div>
          )}
          {flash > 0 && <div key={flash} className="flash" />}
        </div>
      )}
      <p className="dica">
        Encaixe a tabela de respostas ({nQuestoes} questões) dentro do quadro, com o cabeçalho na
        faixa de cima.
        {automatico && analisar && ' A foto é tirada sozinha quando a tabela encaixa.'}
      </p>
      <label className="alternar">
        <input type="checkbox" checked={automatico} onChange={(e) => setAutomatico(e.target.checked)} />
        Captura automática
      </label>
      <div className="acoes">
        <button className="botao secundario" onClick={onFechar}>
          Desligar
        </button>
        <button className="botao" disabled={!tamanho} onClick={capturar}>
          📸 Capturar
        </button>
      </div>
    </div>
  )
}
