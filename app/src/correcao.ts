// Correção de uma folha a partir do gabarito e das respostas lidas (seção 2.1
// da documentação). Não depende da tela nem do OpenCV.

export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const

export type Gabarito = {
  // letra correta de cada questão; '' enquanto o professor não escolheu
  letras: string[]
  // valor de cada questão, em pontos
  valores: number[]
}

// O que o professor decidiu numa questão: a letra marcada pelo aluno ou 'X'
// (em branco, duas marcadas ou ilegível: não vale ponto). Vale para as
// questões em dúvida e também para corrigir uma leitura errada.
export type Confirmacao = string

export type Questao = {
  numero: number
  correta: string
  // o que o app leu: 'A' a 'E', '?' (em branco ou incerta) ou '*' (duas)
  lida: string
  // a letra que vale para a nota: a lida ou a confirmada pelo professor;
  // null enquanto a dúvida não foi confirmada
  final: string | null
  // o professor trocou uma letra que o app tinha lido sem dúvida
  alterada: boolean
  certa: boolean
  valor: number
}

export type Correcao = {
  questoes: Questao[]
  acertos: number
  // soma dos valores das questões certas
  nota: number
  // soma de todos os valores
  total: number
  // questões em dúvida ainda sem confirmação
  pendentes: number
}

export function duvida(letra: string) {
  return letra === '?' || letra === '*'
}

export function gabaritoVazio(nQuestoes: number, valor = 1): Gabarito {
  return { letras: Array(nQuestoes).fill(''), valores: Array(nQuestoes).fill(valor) }
}

// Muda o número de questões mantendo o que já foi preenchido. As questões
// novas recebem o valor da última.
export function redimensionar(g: Gabarito, nQuestoes: number): Gabarito {
  const valorNovo = g.valores.at(-1) ?? 1
  return {
    letras: Array.from({ length: nQuestoes }, (_, i) => g.letras[i] ?? ''),
    valores: Array.from({ length: nQuestoes }, (_, i) => g.valores[i] ?? valorNovo),
  }
}

// Divide um total igualmente entre as questões, com duas casas decimais. O
// arredondamento vai para a última questão, para a soma bater com o total.
export function distribuir<G extends Gabarito>(g: G, total: number): G {
  const n = g.letras.length
  const cada = Math.floor((total / n) * 100) / 100
  const valores = Array(n).fill(cada)
  valores[n - 1] = Math.round((total - cada * (n - 1)) * 100) / 100
  return { ...g, valores }
}

export function soma(valores: number[]) {
  // em centésimos, para 0,1 + 0,2 dar 0,3
  return Math.round(valores.reduce((a, b) => a + b * 100, 0)) / 100
}

export function gabaritoCompleto(g: Gabarito) {
  return g.letras.length > 0 && g.letras.every((l) => l !== '') && g.valores.every((v) => v >= 0)
}

export function corrigir(
  g: Gabarito,
  lidas: string[],
  confirmacoes: Record<number, Confirmacao> = {},
): Correcao {
  const questoes = g.letras.map((correta, i): Questao => {
    const lida = lidas[i] ?? '?'
    const final = confirmacoes[i] ?? (duvida(lida) ? null : lida)
    const alterada = !duvida(lida) && final !== lida
    return { numero: i + 1, correta, lida, final, alterada, certa: final === correta, valor: g.valores[i] }
  })
  return {
    questoes,
    acertos: questoes.filter((q) => q.certa).length,
    nota: soma(questoes.filter((q) => q.certa).map((q) => q.valor)),
    total: soma(g.valores),
    pendentes: questoes.filter((q) => q.final === null).length,
  }
}

// Número em pt-BR com até duas casas: 7,5 e não 7.50.
export function formatarNota(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

// Lê um número digitado com vírgula ou ponto. NaN se não for um número.
export function lerNumero(texto: string) {
  const t = texto.trim().replace(',', '.')
  return t === '' || !/^\d*\.?\d*$/.test(t) ? NaN : Number(t)
}
