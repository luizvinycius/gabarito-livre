// Mensagens trocadas entre a tela e o worker do OpenCV.

export type Circulo = { x: number; y: number; r: number }

// letra: 'A' a 'E', '?' (em branco ou incerto) ou '*' (duas marcadas)
export type RespostaLida = { letra: string; preenchimento: number[] }

export type Mensagem =
  | { tipo: 'carregar' }
  | {
      tipo: 'processar'
      largura: number
      altura: number
      pixels: ArrayBuffer
      nQuestoes: number
      // a imagem é reduzida para esta largura no worker, com INTER_AREA,
      // como no protótipo em Python
      larguraAlvo: number
    }

export type Resposta =
  | { tipo: 'pronto'; versao: string }
  | {
      tipo: 'resultado'
      tempos: Record<string, number>
      total: number
      contornos: number
      circulos: Circulo[]
      grade: Circulo[][] | null
      // alguma linha escolhida não parece ser da tabela: provavelmente ela
      // ficou cortada; todas as respostas vêm como '?'
      tabelaCortada: boolean
      // pontuação de anel (0 a 5) de cada linha, para diagnóstico
      aneis: number[]
      respostas: RespostaLida[]
    }
  | { tipo: 'erro'; mensagem: string }
