// Regras da captura automática da câmera (Camera.tsx), separadas para
// poderem ser testadas sem a câmera.

import type { Leitura } from './omr/useLeitor'

export type EstadoQuadro = 'desligado' | 'procurando' | 'cortada' | 'extras' | 'segure' | 'troque' | 'encaixou'

// Duas leituras seguidas contam como "parada" se os cantos da grade andaram
// menos que esta fração do raio das bolinhas.
const PARADA = 0.35

type LeituraQuadro = Pick<Leitura, 'grade' | 'respostas' | 'tabelaCortada' | 'linhasExtras'>

// Avalia uma leitura do quadro ao vivo: 'segure' quando a tabela inteira
// está no quadro e pode ser capturada.
export function avaliarQuadro(r: LeituraQuadro, nQuestoes: number): EstadoQuadro {
  if (r.respostas.length !== nQuestoes || !r.grade) return 'procurando'
  if (r.tabelaCortada) return 'cortada'
  if (r.linhasExtras > 0) return 'extras'
  return 'segure'
}

// A tabela ficou parada entre duas leituras: os cantos da grade andaram
// pouco e as letras lidas são as mesmas (uma foto tremida costuma mudar
// alguma letra).
export function parada(a: LeituraQuadro, b: LeituraQuadro): boolean {
  if (!a.grade?.length || !b.grade || a.grade.length !== b.grade.length) return false
  const [a1, a2] = [a.grade[0][0], a.grade.at(-1)!.at(-1)!]
  const [b1, b2] = [b.grade[0][0], b.grade.at(-1)!.at(-1)!]
  const limite = PARADA * a1.r
  const letras = (r: LeituraQuadro) => r.respostas.map((x) => x.letra).join('')
  return (
    Math.hypot(a1.x - b1.x, a1.y - b1.y) < limite &&
    Math.hypot(a2.x - b2.x, a2.y - b2.y) < limite &&
    letras(a) === letras(b)
  )
}
