// Web Worker de módulo: carrega o OpenCV.js e roda a leitura (processar.ts)
// fora da thread da tela.

import * as opencv from '@techstark/opencv-js'
import type { Mensagem, Resposta } from './protocolo'
import { type CV, processar, versaoOpenCV } from './processar'

// O tsconfig usa a lib DOM; aqui declaramos só o que o worker usa.
const escopo = self as unknown as {
  postMessage(r: Resposta): void
  onmessage: ((e: MessageEvent<Mensagem>) => void) | null
}

let cv: CV | null = null

function responder(r: Resposta) {
  escopo.postMessage(r)
}

async function carregar() {
  // O pacote é CommonJS: o módulo vem em .default e pode ser uma Promise.
  let m: CV = (opencv as CV).default ?? opencv
  if (m instanceof Promise) m = await m
  cv = m
  // Aquecimento: a primeira execução de cada função do OpenCV é bem mais
  // lenta (o navegador ainda está compilando). Roda uma leitura numa folha
  // em branco para a primeira folha de verdade já sair rápida.
  const largura = 800
  const altura = 700
  const folha = new Uint8Array(largura * altura * 4).fill(255)
  processar(m, largura, altura, folha.buffer, 8, largura)
  responder({ tipo: 'pronto', versao: versaoOpenCV(m) })
}

escopo.onmessage = async (e: MessageEvent<Mensagem>) => {
  try {
    const msg = e.data
    if (msg.tipo === 'carregar') await carregar()
    else if (!cv) throw new Error('OpenCV ainda não carregou')
    else responder(processar(cv, msg.largura, msg.altura, msg.pixels, msg.nQuestoes, msg.larguraAlvo, msg.procurar))
  } catch (err) {
    responder({ tipo: 'erro', mensagem: err instanceof Error ? err.message : String(err) })
  }
}
