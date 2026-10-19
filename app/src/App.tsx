// Página de teste do OpenCV.js no celular (seção 8.5 da documentação).
// Carrega uma foto, roda as etapas pesadas da leitura num Web Worker e mostra
// quanto tempo cada uma levou.

import { useEffect, useRef, useState } from 'react'
import type { Circulo, Mensagem, Resposta } from './omr/protocolo'

const LARGURA_ALVO = 1000

type Medicao = {
  preparo: number
  tempos: Record<string, number>
  total: number
  ida_e_volta: number
  contornos: number
  circulos: Circulo[]
}

function ms(n: number) {
  return `${Math.round(n)} ms`
}

function desenharCirculos(c: HTMLCanvasElement | null, circulos: Circulo[]) {
  const ctx = c?.getContext('2d')
  if (!ctx) return
  ctx.strokeStyle = '#00c853'
  ctx.lineWidth = 3
  for (const { x, y, r } of circulos) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.stroke()
  }
}

export default function App() {
  const worker = useRef<Worker | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const imagem = useRef<ImageBitmap | null>(null)
  const inicioEnvio = useRef(0)
  const preparo = useRef(0)
  const [carga, setCarga] = useState<{ ms: number; versao: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [medicoes, setMedicoes] = useState<Medicao[]>([])

  useEffect(() => {
    const inicio = performance.now()
    const w = new Worker(new URL('./omr/worker.ts', import.meta.url), { type: 'module' })
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
        }
        setMedicoes((anteriores) => [...anteriores, m])
        desenharCirculos(canvas.current, r.circulos)
        setOcupado(false)
      }
    }
    w.onerror = (e) => setErro(`Falha no worker: ${e.message || 'erro desconhecido'}`)
    w.postMessage({ tipo: 'carregar' } satisfies Mensagem)
    return () => w.terminate()
  }, [])

  function desenharFoto(): ImageData | null {
    const foto = imagem.current
    const c = canvas.current
    if (!foto || !c) return null
    const escala = LARGURA_ALVO / foto.width
    c.width = LARGURA_ALVO
    c.height = Math.round(foto.height * escala)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(foto, 0, 0, c.width, c.height)
    return ctx.getImageData(0, 0, c.width, c.height)
  }

  function rodar() {
    const t0 = performance.now()
    const dados = desenharFoto()
    if (!dados || !worker.current) return
    preparo.current = performance.now() - t0
    setErro(null)
    setOcupado(true)
    inicioEnvio.current = performance.now()
    const pixels = dados.data.buffer
    worker.current.postMessage(
      { tipo: 'processar', largura: dados.width, altura: dados.height, pixels } satisfies Mensagem,
      [pixels],
    )
  }

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      imagem.current?.close()
      imagem.current = await createImageBitmap(arquivo)
      setMedicoes([])
      rodar()
    } catch (err) {
      setErro(`Não consegui abrir a foto: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const relatorio = [
    `Navegador: ${navigator.userAgent}`,
    carga ? `OpenCV ${carga.versao} carregou em ${ms(carga.ms)}` : 'OpenCV não carregou',
    ...medicoes.map(
      (m, i) =>
        `Rodada ${i + 1}: total ${ms(m.preparo + m.ida_e_volta)} ` +
        `(preparo ${ms(m.preparo)}, worker ${ms(m.total)}), ` +
        `${m.circulos.length} círculos em ${m.contornos} contornos`,
    ),
  ].join('\n')

  return (
    <main>
      <h1>Teste do OpenCV.js</h1>

      <section className="cartao">
        {erro && <p className="erro">{erro}</p>}
        {carga ? (
          <p>
            ✅ OpenCV {carga.versao} carregado em <strong>{ms(carga.ms)}</strong>
          </p>
        ) : (
          !erro && <p>⏳ Carregando o OpenCV (cerca de 13 MB)…</p>
        )}

        <label className={`botao ${!carga || ocupado ? 'desativado' : ''}`}>
          📷 Escolher ou tirar foto
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
