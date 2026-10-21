// Página de teste da leitura no celular (seção 8.5 da documentação), o
// "modo de desenvolvedor" (endereço com #teste). Carrega uma foto, roda o
// algoritmo de leitura num Web Worker e mostra as respostas lidas e quanto
// tempo cada etapa levou.

import { useEffect, useRef, useState } from 'react'
import type { Circulo, Mensagem, Resposta, RespostaLida } from '../omr/protocolo'
import {
  type Foto,
  LARGURA_RECORTE,
  desenharFoto,
  desenharLeitura,
  larguraDoArquivo,
  pixelsParaLeitura,
} from '../omr/imagem'
import Camera from '../Camera'

function textoRespostas(respostas: RespostaLida[]) {
  return respostas.length ? respostas.map((r) => r.letra).join('') : '(tabela não encontrada)'
}

type Medicao = {
  preparo: number
  tempos: Record<string, number>
  total: number
  ida_e_volta: number
  contornos: number
  circulos: Circulo[]
  respostas: RespostaLida[]
  tabelaCortada: boolean
  aneis: number[]
}

// Nome do arquivo do recorte salvo para o conjunto de teste (dataset/).
function nomeRecorte(nQuestoes: number) {
  const agora = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const data = `${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}`
  const hora = `${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}`
  return `recorte-${nQuestoes}q-${data}-${hora}.jpg`
}

function ms(n: number) {
  return `${Math.round(n)} ms`
}

export default function PaginaTeste() {
  const worker = useRef<Worker | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const imagem = useRef<Foto | null>(null)
  const inicioEnvio = useRef(0)
  const preparo = useRef(0)
  const [carga, setCarga] = useState<{ ms: number; versao: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [medicoes, setMedicoes] = useState<Medicao[]>([])
  const [nQuestoes, setNQuestoes] = useState(8)
  // A câmera fica ligada (só escondida) entre uma folha e outra: religar
  // a câmera faz o Safari pedir permissão de novo.
  // Recorte da última captura já em JPEG: o compartilhamento no iPhone só
  // funciona se for chamado direto no toque, sem esperar a conversão.
  const [arquivoRecorte, setArquivoRecorte] = useState<File | null>(null)
  const [camera, setCamera] = useState<'desligada' | 'visivel' | 'escondida'>('desligada')

  useEffect(() => {
    const inicio = performance.now()
    const w = new Worker(new URL('../omr/worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<Resposta>) => {
      const r = e.data
      if (r.tipo === 'pronto') setCarga({ ms: performance.now() - inicio, versao: r.versao })
      else if (r.tipo === 'erro') {
        setErro(r.mensagem)
        setOcupado(false)
      } else {
        const m: Medicao = {
          preparo: preparo.current,
          tempos: r.tempos,
          total: r.total,
          ida_e_volta: performance.now() - inicioEnvio.current,
          contornos: r.contornos,
          circulos: r.circulos,
          respostas: r.respostas,
          tabelaCortada: r.tabelaCortada,
          aneis: r.aneis,
        }
        setMedicoes((anteriores) => [...anteriores, m])
        desenharLeitura(canvas.current, r.circulos, r.grade, r.respostas)
        setOcupado(false)
      }
    }
    w.onerror = (e) => setErro(`Falha no worker: ${e.message || 'erro desconhecido'}`)
    w.postMessage({ tipo: 'carregar' } satisfies Mensagem)
    return () => w.terminate()
  }, [])

  function rodar() {
    const t0 = performance.now()
    if (!imagem.current || !worker.current) return
    desenharFoto(canvas.current, imagem.current)
    const dados = pixelsParaLeitura(imagem.current)
    preparo.current = performance.now() - t0
    setErro(null)
    setOcupado(true)
    inicioEnvio.current = performance.now()
    const pixels = dados.data.buffer
    worker.current.postMessage(
      {
        tipo: 'processar',
        largura: dados.width,
        altura: dados.height,
        pixels,
        nQuestoes,
        larguraAlvo: imagem.current.largura,
      } satisfies Mensagem,
      [pixels],
    )
  }

  function usarImagem(nova: Foto) {
    const anterior = imagem.current?.fonte
    if (anterior instanceof ImageBitmap) anterior.close()
    imagem.current = nova
    setArquivoRecorte(null)
    setMedicoes([])
    rodar()
  }

  // No celular, compartilhar abre a folha do sistema (no iPhone dá para
  // "Salvar imagem"); no computador, ou onde não houver, baixa o arquivo.
  async function salvarRecorte() {
    if (!arquivoRecorte) return
    const celular = matchMedia('(pointer: coarse)').matches
    if (celular && navigator.canShare?.({ files: [arquivoRecorte] })) {
      try {
        await navigator.share({ files: [arquivoRecorte] })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setErro(`Não consegui salvar: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      return
    }
    const url = URL.createObjectURL(arquivoRecorte)
    const a = document.createElement('a')
    a.href = url
    a.download = arquivoRecorte.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      usarImagem({ fonte: await createImageBitmap(arquivo), largura: larguraDoArquivo(arquivo.name) })
    } catch (err) {
      setErro(`Não consegui abrir a foto: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const ultima = medicoes.at(-1)
  const relatorio = [
    `Navegador: ${navigator.userAgent}`,
    carga ? `OpenCV ${carga.versao} carregou em ${ms(carga.ms)}` : 'OpenCV não carregou',
    ...medicoes.map(
      (m, i) =>
        `Rodada ${i + 1}: total ${ms(m.preparo + m.ida_e_volta)} ` +
        `(preparo ${ms(m.preparo)}, worker ${ms(m.total)}), ` +
        `${m.circulos.length} círculos em ${m.contornos} contornos`,
    ),
    ...(ultima ? [`Respostas lidas: ${textoRespostas(ultima.respostas)}`] : []),
    ...(ultima?.tabelaCortada ? ['Aviso: tabela cortada'] : []),
    ...(ultima ? [`Anéis por linha: ${ultima.aneis.map((a) => a.toFixed(1)).join(' ')}`] : []),
    ...(ultima?.respostas ?? []).flatMap((r, i) =>
      r.letra === '?' || r.letra === '*'
        ? [`Dúvida Q${i + 1}: ${r.preenchimento.map((p) => p.toFixed(2)).join(' ')}`]
        : [],
    ),
  ].join('\n')

  return (
    <main>
      <header className="topo">
        <h1>Teste da leitura</h1>
        <a className="chip" href="#">
          ← App
        </a>
      </header>

      {camera !== 'desligada' && (
        <section className="cartao" hidden={camera === 'escondida'}>
          <Camera
            nQuestoes={nQuestoes}
            visivel={camera === 'visivel'}
            onFechar={() => setCamera('desligada')}
            onCapturar={(recorte) => {
              setCamera('escondida')
              usarImagem({ fonte: recorte, largura: LARGURA_RECORTE })
              const nome = nomeRecorte(nQuestoes)
              recorte.toBlob(
                (blob) => blob && setArquivoRecorte(new File([blob], nome, { type: 'image/jpeg' })),
                'image/jpeg',
                0.92,
              )
            }}
          />
        </section>
      )}

      <section className="cartao" hidden={camera === 'visivel'}>
        {erro && <p className="erro">{erro}</p>}
        {carga ? (
          <p>
            ✅ OpenCV {carga.versao} carregado em <strong>{ms(carga.ms)}</strong>
          </p>
        ) : (
          !erro && <p>⏳ Carregando o OpenCV (cerca de 13 MB)…</p>
        )}

        <label className="campo">
          Número de questões
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={nQuestoes}
            onChange={(e) => setNQuestoes(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          />
        </label>

        <button className="botao" disabled={!carga || ocupado} onClick={() => setCamera('visivel')}>
          📷 {camera === 'escondida' ? 'Próxima folha' : 'Abrir câmera'}
        </button>
        {camera === 'escondida' && (
          <button className="botao secundario" onClick={() => setCamera('desligada')}>
            Desligar câmera
          </button>
        )}
        <label className={`botao secundario ${!carga || ocupado ? 'desativado' : ''}`}>
          🖼️ Escolher foto da galeria
          <input
            type="file"
            accept="image/*"
            disabled={!carga || ocupado}
            onChange={(e) => escolherFoto(e.target.files?.[0])}
          />
        </label>
        {medicoes.length > 0 && (
          <button className="botao secundario" disabled={ocupado} onClick={rodar}>
            🔁 Rodar de novo
          </button>
        )}
        {ocupado && <p>⏳ Processando…</p>}
      </section>

      {ultima && (
        <section className="cartao">
          <h2>Respostas lidas</h2>
          {ultima.respostas.length === 0 && (
            <p className="erro">Não encontrei a tabela de respostas nesta foto.</p>
          )}
          {ultima.tabelaCortada && (
            <p className="erro">
              A tabela parece estar cortada ou fora do quadro. Afaste um pouco o celular e tente de
              novo.
            </p>
          )}
          {ultima.respostas.length > 0 && (
            <ol className="respostas">
              {ultima.respostas.map((r, i) => (
                <li key={i} className={r.letra === '?' || r.letra === '*' ? 'duvida' : ''}>
                  <span>{i + 1}</span>
                  <strong>{r.letra}</strong>
                </li>
              ))}
            </ol>
          )}
          <p className="dica">
            <strong>?</strong> = em branco ou incerta · <strong>*</strong> = duas marcadas
          </p>
          {arquivoRecorte && (
            <>
              <button className="botao secundario" onClick={salvarRecorte}>
                💾 Salvar recorte para o conjunto de teste
              </button>
              <p className="dica">
                Arquivo: <code>{arquivoRecorte.name}</code>. Anote as respostas <strong>reais</strong>{' '}
                da folha no <code>dataset/respostas.csv</code>, não as lidas pelo app.
              </p>
            </>
          )}
        </section>
      )}

      {medicoes.length > 0 && (
        <section className="cartao">
          <h2>Tempos</h2>
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                {medicoes.map((_, i) => (
                  <th key={i}>#{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>preparar foto (tela)</td>
                {medicoes.map((m, i) => (
                  <td key={i}>{ms(m.preparo)}</td>
                ))}
              </tr>
              {Object.keys(medicoes[0].tempos).map((etapa) => (
                <tr key={etapa}>
                  <td>{etapa}</td>
                  {medicoes.map((m, i) => (
                    <td key={i}>{ms(m.tempos[etapa])}</td>
                  ))}
                </tr>
              ))}
              <tr className="total">
                <td>total</td>
                {medicoes.map((m, i) => (
                  <td key={i}>{ms(m.preparo + m.ida_e_volta)}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="dica">Meta: menos de 2000 ms por folha.</p>
          <h2>Para enviar ao grupo</h2>
          <textarea readOnly value={relatorio} rows={6} />
        </section>
      )}

      <canvas ref={canvas} />
    </main>
  )
}
