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

//
// A câmera ocupa a tela inteira (por cima da página), com os botões sempre
// visíveis embaixo: antes, no celular, era preciso rolar a página para achar
// o "Capturar". A geometria do quadro e do vídeo na tela está em visor.ts.

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { type EstadoQuadro, type TentativaQuadro, avaliarQuadro, parada } from './captura'
import type { Leitura } from './omr/useLeitor'
import { guardarSom, prepararSom, somLigado } from './som'
import { LINHAS_CABECALHO, type Tamanho, quadroNoVideo, tamanhoVisor } from './visor'

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
  // na barra de cima (por exemplo, "Folha 3 · Prova A")
  titulo?: string
  // botões no canto da barra de cima (Turma, Gabarito)
  atalhos?: ReactNode
  // mensagem de erro acima dos botões (por exemplo, da foto da galeria)
  aviso?: string | null
  // com ele, aparece o botão de escolher uma foto da galeria
  onGaleria?: (arquivo: File | undefined) => void
  // mostra a opção de ligar e desligar o bip da leitura (quem toca o bip
  // é a tela, quando a leitura fica pronta)
  comSom?: boolean
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
  // cada leitura do quadro ao vivo (log da captura, na página de teste)
  onTentativa?: (t: TentativaQuadro) => void
}

export default function Camera({
  nQuestoes,
  titulo,
  atalhos,
  aviso,
  onGaleria,
  comSom = false,
  visivel,
  exigirTroca,
  analisar,
  onCapturar,
  onFechar,
  onTentativa,
}: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const [tamanho, setTamanho] = useState<Tamanho | null>(null)
  const [tamanhoArea, setTamanhoArea] = useState<Tamanho>({ w: 0, h: 0 })
  const [erro, setErro] = useState<string | null>(null)
  const [automatico, setAutomatico] = useState(automaticoSalvo)
  const [som, setSom] = useState(somLigado)
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

  // Tamanho da área entre a barra de cima e os botões: muda ao girar o
  // celular e quando a barra do Safari aparece ou some. Escondida, mede 0.
  useEffect(() => {
    const el = area.current
    if (!el) return
    const medir = () => setTamanhoArea({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  // Com a câmera na tela, a página de baixo não rola (no iPhone, arrastar
  // a câmera rolava a página e escondia os botões).
  useEffect(() => {
    if (!visivel) return
    const raiz = document.documentElement
    raiz.classList.add('camera-aberta')
    return () => raiz.classList.remove('camera-aberta')
  }, [visivel])

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

  // Quadro em frações do vídeo (0 a 1) e o tamanho do vídeo na tela (px).
  const quadro = quadroNoVideo(nQuestoes, tamanho)
  const { x: qx, y: qy, w: qw, h: qh } = quadro
  const visor = tamanhoVisor(tamanhoArea, tamanho, quadro)

  // destino: o canvas da leitura anterior do quadro ao vivo, reaproveitado
  // (criar um canvas do tamanho do recorte a cada leitura pesa no Android).
  // Com willReadFrequently, o canvas fica na memória e a leitura pega os
  // pixels dele sem copiar para outro canvas (pixelsParaLeitura).
  function recortar(destino?: HTMLCanvasElement): HTMLCanvasElement | null {
    const v = video.current
    if (!v || !tamanho || v.readyState < 2) return null
    const mx = qw * MARGEM_X
    const my = qh * MARGEM_Y
    const x0 = Math.max(0, qx - mx) * tamanho.w
    const y0 = Math.max(0, qy - my) * tamanho.h
    const x1 = Math.min(1, qx + qw + mx) * tamanho.w
    const y1 = Math.min(1, qy + qh + my) * tamanho.h
    const recorte = destino ?? document.createElement('canvas')
    const largura = Math.round(x1 - x0)
    const altura = Math.round(y1 - y0)
    if (recorte.width !== largura) recorte.width = largura
    if (recorte.height !== altura) recorte.height = altura
    recorte
      .getContext('2d', { willReadFrequently: true })!
      .drawImage(v, x0, y0, x1 - x0, y1 - y0, 0, 0, recorte.width, recorte.height)
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
    prepararSom()
    const recorte = recortar()
    if (recorte) entregar(recorte)
  }

  // o toque na caixa também libera o áudio no iPhone
  function mudarSom(ligado: boolean) {
    setSom(ligado)
    guardarSom(ligado)
    if (ligado) prepararSom()
  }

  // As funções recortar e entregar mudam a cada render; o laço usa sempre
  // as mais novas.
  const recortarAtual = useRef(recortar)
  const entregarAtual = useRef(entregar)
  const tentativaAtual = useRef(onTentativa)
  useEffect(() => {
    recortarAtual.current = recortar
    entregarAtual.current = entregar
    tentativaAtual.current = onTentativa
  })

  const autoLigado = visivel && automatico && !!analisar && !!tamanho
  useEffect(() => {
    if (!autoLigado) return
    let ativo = true
    const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))
    async function laco() {
      let anterior: Leitura | null = null
      const inicio = performance.now()
      // registra a leitura no log da captura (se a tela pediu)
      const registrar = (recorte: HTMLCanvasElement, estado: TentativaQuadro['estado'], r?: Leitura, erro?: string) =>
        tentativaAtual.current?.({
          ms: Math.round(performance.now() - inicio),
          estado,
          letras: r?.respostas.map((x) => x.letra).join('') ?? '',
          aneis: r?.aneis.map((a) => Math.round(a * 100) / 100) ?? [],
          detectadas: r?.detectadas ?? [],
          tabelaCortada: r?.tabelaCortada ?? false,
          linhasExtras: r?.linhasExtras ?? 0,
          tempoLeitura: Math.round(r ? r.total + r.preparo : 0),
          video: [video.current?.videoWidth ?? 0, video.current?.videoHeight ?? 0],
          recorte: [recorte.width, recorte.height],
          ...(erro ? { erro } : {}),
        })
      await esperar(0)
      setEstado('procurando')
      // o mesmo canvas para todas as leituras até a captura, que o entrega
      let quadro: HTMLCanvasElement | undefined
      while (ativo) {
        const recorte = recortarAtual.current(quadro)
        if (!recorte) {
          await esperar(200)
          continue
        }
        quadro = recorte
        let r: Leitura
        try {
          r = await analisar!(recorte)
        } catch (err) {
          registrar(recorte, 'erro', undefined, err instanceof Error ? err.message : String(err))
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
          registrar(recorte, avaliacao, r)
        } else {
          const letras = r.respostas.map((x) => x.letra).join('')
          if (!armada.current && letras !== ultimaCaptura.current) armada.current = true
          if (!armada.current) {
            anterior = null
            setEstado('troque')
            registrar(recorte, 'troque', r)
          } else if (anterior && parada(anterior, r)) {
            setEstado('encaixou')
            registrar(recorte, 'encaixou', r)
            navigator.vibrate?.(60)
            entregarAtual.current(recorte, r)
            return
          } else {
            anterior = r
            setEstado('segure')
            registrar(recorte, 'segure', r)
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

  // antes de medir, o visor ocupa a área inteira (o CSS); depois, o tamanho
  // do vídeo na tela
  const estiloVisor = visor.w ? { width: `${visor.w}px`, height: `${visor.h}px` } : undefined
  const alturaCabecalho = `${(LINHAS_CABECALHO / (nQuestoes + LINHAS_CABECALHO)) * 100}%`

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-label={titulo ?? 'Câmera'}>
      <header className="camera-topo">
        <div className="camera-titulo">
          {titulo && <h2>{titulo}</h2>}
          <p className="dica">
            Encaixe a tabela ({nQuestoes} questões) no quadro, com o cabeçalho na faixa de cima.
          </p>
        </div>
        {atalhos && <div className="atalhos">{atalhos}</div>}
      </header>

      <div className="camera-area" ref={area}>
        {erro ? (
          <p className="erro">
            Não consegui abrir a câmera: {erro}. Confira se o site tem permissão para usar a câmera.
          </p>
        ) : (
          <div className="visor" style={estiloVisor}>
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
                <div className="cabecalho" style={{ height: alturaCabecalho }}>
                  Questão · Respostas
                </div>
              </div>
            )}
          </div>
        )}
        {situacao !== 'desligado' && (
          <div className={`situacao estado-${situacao}`} role="status">
            {MENSAGEM[situacao]}
          </div>
        )}
        {flash > 0 && <div key={flash} className="flash" />}
      </div>

      <div className="camera-controles">
        {aviso && (
          <p className="erro" role="alert">
            {aviso}
          </p>
        )}
        <div className="acoes">
          <button className="botao secundario" onClick={onFechar}>
            Desligar
          </button>
          <button className="botao" disabled={!tamanho} onClick={capturar}>
            📸 Capturar
          </button>
        </div>
        <div className="camera-opcoes">
          <div className="camera-alternar">
            <label className="alternar">
              <input type="checkbox" checked={automatico} onChange={(e) => setAutomatico(e.target.checked)} />
              Captura automática
            </label>
            {comSom && (
              <label className="alternar">
                <input type="checkbox" checked={som} onChange={(e) => mudarSom(e.target.checked)} />
                Som ao ler a folha
              </label>
            )}
          </div>
          {onGaleria && (
            <label className="chip">
              🖼️ Galeria
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  prepararSom()
                  onGaleria(e.target.files?.[0])
                }}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
