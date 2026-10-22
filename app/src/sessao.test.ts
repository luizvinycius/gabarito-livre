import { describe, expect, it } from 'vitest'
import {
  type Estado,
  type Folha,
  carregarEstado,
  criarGabarito,
  duplicarGabarito,
  encerrarSessao,
  escolherGabarito,
  estadoInicial,
  excluirFolha,
  excluirGabarito,
  gabaritoAtual,
  linhasDaTurma,
  mudarGabarito,
  podeExcluir,
  podeMudarQuantidade,
  resumir,
  salvarFolha,
} from './sessao'

function folha(e: Estado, lidas: string, extra: Partial<Folha> = {}): Folha {
  return {
    id: `f${e.folhas.length + 1}`,
    gabaritoId: e.atual,
    criada: 0,
    lidas: [...lidas],
    confirmacoes: {},
    identificacao: '',
    grade: null,
    largura: 800,
    ...extra,
  }
}

// Estado com o gabarito BABCDACC, valendo 1 ponto cada questão.
function comGabarito(): Estado {
  const e = estadoInicial()
  return mudarGabarito(e, { ...gabaritoAtual(e), letras: [...'BABCDACC'] })
}

describe('carregarEstado', () => {
  it('começa com um gabarito vazio quando não há nada guardado', () => {
    const e = carregarEstado(null, null, null)
    expect(e.gabaritos).toHaveLength(1)
    expect(e.gabaritos[0].nome).toBe('Prova 1')
    expect(e.atual).toBe(e.gabaritos[0].id)
    expect(e.folhas).toEqual([])
  })

  it('aproveita o gabarito da versão anterior, que não tinha nome', () => {
    const antigo = JSON.stringify({ letras: [...'ABCDE'], valores: [2, 2, 2, 2, 2] })
    const e = carregarEstado(null, null, antigo)
    expect(gabaritoAtual(e).letras.join('')).toBe('ABCDE')
    expect(gabaritoAtual(e).nome).toBe('Prova 1')
  })

  it('volta ao que foi gravado', () => {
    let e = criarGabarito(comGabarito())
    e = salvarFolha(e, folha(e, '????????'))
    const gab = JSON.stringify({ gabaritos: e.gabaritos, atual: e.atual })
    const de = carregarEstado(gab, JSON.stringify(e.folhas), null)
    expect(de).toEqual(e)
  })

  it('descarta o que estiver corrompido', () => {
    expect(carregarEstado('{não é json', '[1, 2]', null).gabaritos).toHaveLength(1)
    const gab = JSON.stringify({ gabaritos: [{ id: 'a', nome: 'A', letras: ['A'], valores: ['x'] }], atual: 'a' })
    expect(carregarEstado(gab, null, null).gabaritos[0].id).not.toBe('a')
  })

  it('descarta folhas de um gabarito que não existe mais', () => {
    const e = comGabarito()
    const gab = JSON.stringify({ gabaritos: e.gabaritos, atual: e.atual })
    const folhas = JSON.stringify([folha(e, 'BABCDACC'), folha(e, 'BABCDACC', { id: 'x', gabaritoId: 'outro' })])
    expect(carregarEstado(gab, folhas, null).folhas).toHaveLength(1)
  })
})

describe('gabaritos', () => {
  it('cria um gabarito novo com o mesmo número de questões e o seleciona', () => {
    const e = criarGabarito(comGabarito())
    expect(e.gabaritos).toHaveLength(2)
    expect(gabaritoAtual(e).nome).toBe('Prova 2')
    expect(gabaritoAtual(e).letras).toEqual(Array(8).fill(''))
  })

  it('duplica o gabarito atual com outro nome', () => {
    let e = duplicarGabarito(comGabarito())
    expect(gabaritoAtual(e).nome).toBe('Prova 1 (cópia)')
    expect(gabaritoAtual(e).letras.join('')).toBe('BABCDACC')
    e = escolherGabarito(e, e.gabaritos[0].id)
    e = duplicarGabarito(e)
    expect(gabaritoAtual(e).nome).toBe('Prova 1 (cópia) 2')
  })

  it('não exclui o último gabarito nem um com folhas corrigidas', () => {
    let e = comGabarito()
    const primeiro = e.atual
    expect(podeExcluir(e, primeiro)).toBe(false)
    e = criarGabarito(e)
    e = escolherGabarito(e, primeiro)
    e = salvarFolha(e, folha(e, 'BABCDACC'))
    expect(podeExcluir(e, primeiro)).toBe(false)
    expect(excluirGabarito(e, primeiro)).toBe(e)
    const segundo = e.gabaritos[1].id
    e = excluirGabarito(e, segundo)
    expect(e.gabaritos.map((g) => g.id)).toEqual([primeiro])
  })

  it('ao excluir o gabarito em uso, passa para outro', () => {
    let e = criarGabarito(comGabarito())
    const novo = e.atual
    e = excluirGabarito(e, novo)
    expect(e.atual).toBe(e.gabaritos[0].id)
  })

  it('só deixa mudar o número de questões sem folhas corrigidas', () => {
    let e = comGabarito()
    expect(podeMudarQuantidade(e, e.atual)).toBe(true)
    e = salvarFolha(e, folha(e, 'BABCDACC'))
    expect(podeMudarQuantidade(e, e.atual)).toBe(false)
    expect(podeMudarQuantidade(encerrarSessao(e), e.atual)).toBe(true)
  })
})

describe('turma', () => {
  it('recalcula as notas quando o gabarito muda', () => {
    let e = comGabarito()
    e = salvarFolha(e, folha(e, 'BABCDACC'))
    expect(linhasDaTurma(e)[0].nota).toBe(8)
    // o professor tinha errado a resposta da questão 1
    e = mudarGabarito(e, { ...gabaritoAtual(e), letras: [...'AABCDACC'] })
    expect(linhasDaTurma(e)[0].nota).toBe(7)
  })

  it('edita e exclui uma folha', () => {
    let e = comGabarito()
    e = salvarFolha(e, folha(e, 'BABCDACC'))
    const f = e.folhas[0]
    e = salvarFolha(e, { ...f, confirmacoes: { 0: 'E' }, identificacao: 'Ana' })
    expect(e.folhas).toHaveLength(1)
    const [linha] = linhasDaTurma(e)
    expect(linha.nota).toBe(7)
    expect(linha.alteradas).toBe(1)
    expect(linha.folha.identificacao).toBe('Ana')
    expect(excluirFolha(e, f.id).folhas).toHaveLength(0)
  })

  it('resume a turma', () => {
    let e = comGabarito()
    e = salvarFolha(e, folha(e, 'BABCDACC'))
    e = salvarFolha(e, folha(e, 'BABCDAEE'))
    e = salvarFolha(e, folha(e, 'EEEEEEEE'))
    const r = resumir(linhasDaTurma(e))!
    expect(r.folhas).toBe(3)
    expect(r.maior).toBe(8)
    expect(r.menor).toBe(0)
    expect(r.media).toBe(4.67)
    expect(r.total).toBe(8)
    expect(resumir([])).toBeNull()
  })

  it('não mostra um total único quando as provas valem pontos diferentes', () => {
    let e = comGabarito()
    e = salvarFolha(e, folha(e, 'BABCDACC'))
    e = criarGabarito(e)
    e = mudarGabarito(e, { ...gabaritoAtual(e), letras: [...'AAAAAAAA'], valores: Array(8).fill(0.5) })
    e = salvarFolha(e, folha(e, 'AAAAAAAA'))
    expect(resumir(linhasDaTurma(e))!.total).toBeNull()
  })
})
