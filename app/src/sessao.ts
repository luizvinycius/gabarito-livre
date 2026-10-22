// Gabaritos salvos com nome (provas A e B, turmas diferentes) e as folhas já
// corrigidas na sessão, guardados no aparelho. A nota de cada folha não é
// guardada: é recalculada a partir do gabarito, então corrigir uma letra do
// gabarito no meio da correção atualiza todas as notas.

import { type Confirmacao, type Gabarito, corrigir, gabaritoVazio } from './correcao'
import type { Circulo } from './omr/protocolo'

export type GabaritoSalvo = Gabarito & { id: string; nome: string }

export type Folha = {
  id: string
  gabaritoId: string
  // Date.now() de quando a folha foi corrigida
  criada: number
  // o que o app leu em cada questão ('A' a 'E', '?' ou '*')
  lidas: string[]
  confirmacoes: Record<number, Confirmacao>
  // nome, número de chamada ou o que o professor quiser (opcional)
  identificacao: string
  // posição das bolinhas na foto guardada, para desenhar a leitura de novo
  grade: Circulo[][] | null
  // largura da leitura (800 ou 1000 px): a foto guardada é redesenhada nela
  largura: number
}

export type Estado = {
  gabaritos: GabaritoSalvo[]
  // id do gabarito em uso
  atual: string
  folhas: Folha[]
}

const CHAVE_GABARITOS = 'gabarito-livre:gabaritos'
const CHAVE_FOLHAS = 'gabarito-livre:folhas'
// versão anterior: um gabarito só, sem nome
const CHAVE_ANTIGA = 'gabarito-livre:gabarito'

export function novoId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function gabaritoValido(g: unknown): g is Gabarito {
  const x = g as Gabarito
  return (
    Array.isArray(x?.letras) &&
    Array.isArray(x?.valores) &&
    x.letras.length > 0 &&
    x.letras.length === x.valores.length &&
    x.letras.every((l) => typeof l === 'string') &&
    x.valores.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
}

function folhaValida(f: unknown): f is Folha {
  const x = f as Folha
  return (
    typeof x?.id === 'string' &&
    typeof x.gabaritoId === 'string' &&
    Array.isArray(x.lidas) &&
    typeof x.confirmacoes === 'object' &&
    x.confirmacoes !== null
  )
}

// Próximo nome livre: "Prova 1", "Prova 2"...
export function proximoNome(gabaritos: GabaritoSalvo[]) {
  const nomes = new Set(gabaritos.map((g) => g.nome))
  let i = 1
  while (nomes.has(`Prova ${i}`)) i++
  return `Prova ${i}`
}

// O nome pedido, ou com um número no fim se já existir: "Prova A (cópia) 2".
export function nomeLivre(gabaritos: GabaritoSalvo[], nome: string) {
  const nomes = new Set(gabaritos.map((g) => g.nome))
  if (!nomes.has(nome)) return nome
  let i = 2
  while (nomes.has(`${nome} ${i}`)) i++
  return `${nome} ${i}`
}

export function estadoInicial(): Estado {
  const g: GabaritoSalvo = { ...gabaritoVazio(8), id: novoId(), nome: 'Prova 1' }
  return { gabaritos: [g], atual: g.id, folhas: [] }
}

/**
 * Monta o estado a partir do que está guardado (texto JSON ou null),
 * descartando o que estiver corrompido. Aproveita o gabarito da versão
 * anterior do app, que não tinha nome.
 */
export function carregarEstado(gabaritosJson: string | null, folhasJson: string | null, antigoJson: string | null): Estado {
  const ler = (t: string | null): unknown => {
    try {
      return t ? JSON.parse(t) : null
    } catch {
      return null
    }
  }
  const salvo = ler(gabaritosJson) as { gabaritos?: unknown[]; atual?: unknown } | null
  let gabaritos: GabaritoSalvo[] = (salvo?.gabaritos ?? []).filter(
    (g): g is GabaritoSalvo => gabaritoValido(g) && typeof (g as GabaritoSalvo).id === 'string',
  )
  gabaritos = gabaritos.map((g) => ({ ...g, nome: typeof g.nome === 'string' && g.nome.trim() ? g.nome : 'Prova' }))
  if (gabaritos.length === 0) {
    const antigo = ler(antigoJson)
    if (gabaritoValido(antigo)) gabaritos = [{ letras: antigo.letras, valores: antigo.valores, id: novoId(), nome: 'Prova 1' }]
  }
  if (gabaritos.length === 0) return estadoInicial()
  const atual = gabaritos.some((g) => g.id === salvo?.atual) ? (salvo!.atual as string) : gabaritos[0].id

  const ids = new Set(gabaritos.map((g) => g.id))
  const folhas = ((ler(folhasJson) as unknown[]) ?? [])
    .filter(folhaValida)
    .filter((f) => ids.has(f.gabaritoId))
    // campos que podem faltar numa folha gravada por uma versão anterior
    .map((f) => ({
      ...f,
      grade: f.grade ?? null,
      largura: f.largura ?? 800,
      identificacao: typeof f.identificacao === 'string' ? f.identificacao : '',
      criada: f.criada ?? 0,
    }))
  return { gabaritos, atual, folhas }
}

export function lerDoAparelho(): Estado {
  try {
    return carregarEstado(
      localStorage.getItem(CHAVE_GABARITOS),
      localStorage.getItem(CHAVE_FOLHAS),
      localStorage.getItem(CHAVE_ANTIGA),
    )
  } catch {
    // sem localStorage (aba anônima, por exemplo): começa do zero
    return estadoInicial()
  }
}

// Devolve false se não deu para guardar (sem espaço ou sem permissão).
export function gravarNoAparelho(e: Estado): boolean {
  try {
    localStorage.setItem(CHAVE_GABARITOS, JSON.stringify({ gabaritos: e.gabaritos, atual: e.atual }))
    localStorage.setItem(CHAVE_FOLHAS, JSON.stringify(e.folhas))
    localStorage.removeItem(CHAVE_ANTIGA)
    return true
  } catch {
    return false
  }
}

// ---- operações (puras: devolvem um estado novo) ----

export function gabaritoAtual(e: Estado): GabaritoSalvo {
  return e.gabaritos.find((g) => g.id === e.atual) ?? e.gabaritos[0]
}

export function folhasDoGabarito(e: Estado, id: string) {
  return e.folhas.filter((f) => f.gabaritoId === id)
}

export function mudarGabarito(e: Estado, g: GabaritoSalvo): Estado {
  return { ...e, gabaritos: e.gabaritos.map((x) => (x.id === g.id ? g : x)) }
}

export function escolherGabarito(e: Estado, id: string): Estado {
  return e.gabaritos.some((g) => g.id === id) ? { ...e, atual: id } : e
}

// Gabarito novo, com o mesmo número de questões e valores do atual.
export function criarGabarito(e: Estado): Estado {
  const base = gabaritoAtual(e)
  const g: GabaritoSalvo = {
    ...gabaritoVazio(base.letras.length),
    valores: [...base.valores],
    id: novoId(),
    nome: proximoNome(e.gabaritos),
  }
  return { ...e, gabaritos: [...e.gabaritos, g], atual: g.id }
}

// Cópia do atual (para fazer a prova B a partir da A, por exemplo).
export function duplicarGabarito(e: Estado): Estado {
  const base = gabaritoAtual(e)
  const g: GabaritoSalvo = {
    letras: [...base.letras],
    valores: [...base.valores],
    id: novoId(),
    nome: nomeLivre(e.gabaritos, `${base.nome} (cópia)`),
  }
  return { ...e, gabaritos: [...e.gabaritos, g], atual: g.id }
}

// Não exclui gabarito com folhas corrigidas nem o último que sobrou.
export function podeExcluir(e: Estado, id: string) {
  return e.gabaritos.length > 1 && folhasDoGabarito(e, id).length === 0
}

export function excluirGabarito(e: Estado, id: string): Estado {
  if (!podeExcluir(e, id)) return e
  const gabaritos = e.gabaritos.filter((g) => g.id !== id)
  return { ...e, gabaritos, atual: e.atual === id ? gabaritos[0].id : e.atual }
}

// Mudar o número de questões com folhas corrigidas deixaria as notas sem
// sentido: só depois de encerrar a sessão (ou com outro gabarito).
export function podeMudarQuantidade(e: Estado, id: string) {
  return folhasDoGabarito(e, id).length === 0
}

export function salvarFolha(e: Estado, f: Folha): Estado {
  const existe = e.folhas.some((x) => x.id === f.id)
  return { ...e, folhas: existe ? e.folhas.map((x) => (x.id === f.id ? f : x)) : [...e.folhas, f] }
}

export function excluirFolha(e: Estado, id: string): Estado {
  return { ...e, folhas: e.folhas.filter((f) => f.id !== id) }
}

export function encerrarSessao(e: Estado): Estado {
  return { ...e, folhas: [] }
}

// ---- resumo da turma ----

export type LinhaTurma = {
  folha: Folha
  numero: number
  gabarito: GabaritoSalvo
  nota: number
  total: number
  acertos: number
  questoes: number
  pendentes: number
  alteradas: number
}

export function linhasDaTurma(e: Estado): LinhaTurma[] {
  return e.folhas.map((folha, i) => {
    const gabarito = e.gabaritos.find((g) => g.id === folha.gabaritoId)!
    const c = corrigir(gabarito, folha.lidas, folha.confirmacoes)
    return {
      folha,
      numero: i + 1,
      gabarito,
      nota: c.nota,
      total: c.total,
      acertos: c.acertos,
      questoes: c.questoes.length,
      pendentes: c.pendentes,
      alteradas: c.questoes.filter((q) => q.alterada).length,
    }
  })
}

export type ResumoTurma = { folhas: number; media: number; maior: number; menor: number; total: number | null }

export function resumir(linhas: LinhaTurma[]): ResumoTurma | null {
  if (linhas.length === 0) return null
  const notas = linhas.map((l) => l.nota)
  const totais = new Set(linhas.map((l) => l.total))
  return {
    folhas: linhas.length,
    media: Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100,
    maior: Math.max(...notas),
    menor: Math.min(...notas),
    // só faz sentido mostrar "de X" se todas as provas valem o mesmo
    total: totais.size === 1 ? linhas[0].total : null,
  }
}

// ---- questões que a turma mais errou ----

export type AcertoQuestao = { numero: number; correta: string; acertos: number; folhas: number }

// Quantas folhas acertaram cada questão, entre as folhas de um gabarito.
export function acertoPorQuestao(linhas: LinhaTurma[], gabaritoId: string): AcertoQuestao[] {
  const doGabarito = linhas.filter((l) => l.gabarito.id === gabaritoId)
  if (doGabarito.length === 0) return []
  const g = doGabarito[0].gabarito
  const correcoes = doGabarito.map((l) => corrigir(g, l.folha.lidas, l.folha.confirmacoes))
  return g.letras.map((correta, i) => ({
    numero: i + 1,
    correta,
    acertos: correcoes.filter((c) => c.questoes[i].certa).length,
    folhas: doGabarito.length,
  }))
}

// ---- exportar as notas ----

// Planilha das notas, uma linha por folha, com a letra que valeu em cada
// questão. CSV com ';' e vírgula decimal, que o Excel em português abre
// direto (com o BOM, os acentos saem certos).
export function planilhaCsv(linhas: LinhaTurma[]): string {
  const maxQuestoes = Math.max(0, ...linhas.map((l) => l.questoes))
  const campo = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const numero = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
  const cabecalho = ['Folha', 'Aluno', 'Gabarito', 'Nota', 'Total', 'Acertos', 'Questões']
  for (let i = 1; i <= maxQuestoes; i++) cabecalho.push(`Q${i}`)
  const corpo = linhas.map((l) => {
    const c = corrigir(l.gabarito, l.folha.lidas, l.folha.confirmacoes)
    const letras = c.questoes.map((q) => (q.final === null ? '?' : q.final === 'X' ? '' : q.final))
    return [
      String(l.numero),
      campo(l.folha.identificacao),
      campo(l.gabarito.nome),
      numero(l.nota),
      numero(l.total),
      String(l.acertos),
      String(l.questoes),
      ...letras,
    ].join(';')
  })
  return '\uFEFF' + [cabecalho.join(';'), ...corpo].join('\r\n') + '\r\n'
}

// Texto curto para colar numa mensagem ou numa planilha (uma folha por linha).
export function notasTexto(linhas: LinhaTurma[]): string {
  const numero = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')
  return linhas
    .map((l) => [`Folha ${l.numero}`, l.folha.identificacao, numero(l.nota)].join('\t'))
    .join('\n')
}
