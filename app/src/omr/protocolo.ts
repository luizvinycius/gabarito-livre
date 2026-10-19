// Mensagens trocadas entre a tela e o worker do OpenCV.

export type Circulo = { x: number; y: number; r: number }

// letra: 'A' a 'E', '?' (em branco ou incerto) ou '*' (duas marcadas)
export type RespostaLida = { letra: string; preenchimento: number[] }

export type Mensagem =
  | { tipo: 'carregar' }
  | { tipo: 'processar'; largura: number; altura: number; pixels: ArrayBuffer; nQuestoes: number }

export type Resposta =
  | { tipo: 'pronto'; versao: string }
  | {
      tipo: 'resultado'
      tempos: Record<string, number>
      total: number
      contornos: number
      circulos: Circulo[]
      grade: Circulo[][] | null
      respostas: RespostaLida[]
    }
  | { tipo: 'erro'; mensagem: string }
