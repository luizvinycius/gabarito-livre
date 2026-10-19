// Mensagens trocadas entre a tela e o worker do OpenCV.

export type Circulo = { x: number; y: number; r: number }

export type Mensagem =
  | { tipo: 'carregar' }
  | { tipo: 'processar'; largura: number; altura: number; pixels: ArrayBuffer }

export type Resposta =
  | { tipo: 'pronto'; versao: string }
  | {
      tipo: 'resultado'
      tempos: Record<string, number>
      total: number
      contornos: number
      circulos: Circulo[]
    }
  | { tipo: 'erro'; mensagem: string }
