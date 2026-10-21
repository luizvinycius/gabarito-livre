// Hook que carrega o worker do OpenCV assim que a tela abre e lê uma foto
// por vez. O carregamento (2 a 7 s nos celulares de teste) acontece enquanto
// o professor preenche o gabarito.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Mensagem, Resposta } from './protocolo'
import { type Foto, pixelsParaLeitura } from './imagem'

export type Leitura = Extract<Resposta, { tipo: 'resultado' }>

type Pendente = { resolver: (r: Leitura) => void; rejeitar: (e: Error) => void }

export function useLeitor() {
  const worker = useRef<Worker | null>(null)
  // O worker responde na ordem em que recebe as fotos: uma fila basta.
  const pendentes = useRef<Pendente[]>([])
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<Resposta>) => {
      const r = e.data
      if (r.tipo === 'pronto') setPronto(true)
      else if (r.tipo === 'erro') {
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
      pendentes.current.push({ resolver, rejeitar })
      const dados = pixelsParaLeitura(foto)
      const pixels = dados.data.buffer
      w.postMessage(
        {
          tipo: 'processar',
          largura: dados.width,
          altura: dados.height,
          pixels,
          nQuestoes,
          larguraAlvo: foto.largura,
        } satisfies Mensagem,
        [pixels],
      )
    })
  }, [])

  return { pronto, erro, ler }
}
