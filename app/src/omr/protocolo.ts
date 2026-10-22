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
      // linhas de bolinhas fora das escolhidas: a tabela tem mais questões
      // que o gabarito. As respostas vêm lidas (das primeiras linhas), mas o
      // app pede para o professor conferir antes de dar a nota.
      linhasExtras: number
      // pontuação de anel (0 a 5) e bolinhas detectadas de cada linha, para
      // diagnóstico
      aneis: number[]
      detectadas: number[]
      respostas: RespostaLida[]
    }
  | { tipo: 'erro'; mensagem: string }
