// Hook que carrega o worker do OpenCV assim que a tela abre e lê uma foto
// por vez. O carregamento (2 a 7 s nos celulares de teste) acontece enquanto
// o professor preenche o gabarito.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Mensagem, Resposta } from './protocolo'
import { type Foto, pixelsParaLeitura, procurarNaFoto } from './imagem'

type Resultado = Extract<Resposta, { tipo: 'resultado' }>

// preparo: tempo (ms) para preparar os pixels na tela, antes do worker
export type Leitura = Resultado & { preparo: number }

type Pendente = { resolver: (r: Resultado) => void; rejeitar: (e: Error) => void }

export function useLeitor() {
  const worker = useRef<Worker | null>(null)
  // O worker responde na ordem em que recebe as fotos: uma fila basta.
  const pendentes = useRef<Pendente[]>([])
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // versão do OpenCV e quanto tempo levou para carregar (página de teste)
  const [carga, setCarga] = useState<{ versao: string; ms: number } | null>(null)

  useEffect(() => {
    const inicio = performance.now()
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<Resposta>) => {
      const r = e.data
      if (r.tipo === 'pronto') {
        setPronto(true)
        setCarga({ versao: r.versao, ms: performance.now() - inicio })
      } else if (r.tipo === 'erro') {
        const p = pendentes.current.shift()
        if (p) p.rejeitar(new Error(r.mensagem))
        else setErro(r.mensagem)
      } else {
        pendentes.current.shift()?.resolver(r)
      }
    }
    w.onerror = (e) => setErro(`Falha ao carregar o leitor: ${e.message || 'erro desconhecido'}`)
    w.postMessage({ tipo: 'carregar' } satisfies Mensagem)
    return () => {
      w.terminate()
      worker.current = null
      pendentes.current = []
    }
  }, [])

  const ler = useCallback((foto: Foto, nQuestoes: number) => {
    return new Promise<Leitura>((resolver, rejeitar) => {
      const w = worker.current
      if (!w) return rejeitar(new Error('O leitor ainda não carregou'))
      const t0 = performance.now()
      const dados = pixelsParaLeitura(foto)
      const preparo = performance.now() - t0
      pendentes.current.push({ resolver: (r) => resolver({ ...r, preparo }), rejeitar })
      const pixels = dados.data.buffer
      w.postMessage(
        {
          tipo: 'processar',
          largura: dados.width,
          altura: dados.height,
          pixels,
          nQuestoes,
          larguraAlvo: foto.largura,
          procurar: procurarNaFoto(foto),
        } satisfies Mensagem,
        [pixels],
      )
    })
  }, [])

  return { pronto, erro, carga, ler }
}
