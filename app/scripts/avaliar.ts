// Mede a precisão da leitura do APP (app/src/omr/) no conjunto de teste, com
// o mesmo CSV e as mesmas regras do poc/avaliar.py. Serve para conferir que
// as duas implementações continuam iguais (seção 3.6 da documentação).
//
// Uso (dentro de app/):
//   npm run avaliar
//   npm run avaliar -- --csv outro.csv --fotos outra/pasta
//   npm run avaliar -- --conjunto sinteticas   (dataset/sinteticas/, do poc/gerar_sinteticas.py)
//   npm run avaliar -- --leituras ts.csv       (grava "arquivo;lido" de cada folha)
//   npm run avaliar -- --detalhes ts.jsonl     (anéis, detectadas e grade de cada folha;
//                                               compare com poc/comparar_detalhes.py)
//
// Folhas com linhas a mais que o gabarito contam como '?' em todas as
// questões: o app lê as primeiras linhas, mas pede para o professor conferir
// antes de dar a nota (no Python, a leitura já devolve '?').
//
// Diferença para o app no celular: aqui a foto é reduzida direto do tamanho
// original com o INTER_AREA do OpenCV, como no Python. No celular, o canvas
// reduz antes para até o dobro da largura alvo.
//
// Sai com código 1 se houver algum erro silencioso.

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import * as opencv from '@techstark/opencv-js'
import { type CV, processar } from '../src/omr/processar'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LARGURA_FOLHA = 1000
const LARGURA_RECORTE = 800

type Folha = { arquivo: string; n: number; respostas: string; celular: string; condicoes: string[] }
type Classe = 'certa' | 'aviso' | 'silenciosa'

// Igual ao classificar() do avaliar.py. Esperada '?': o app tem de pedir
// confirmação (tabela cortada, linhas a mais). Lida '-': tabela não
// encontrada, que o app avisa.
function classificar(esperada: string, lida: string): Classe {
  const letra = 'ABCDE'.includes(lida) && lida !== ''
  if (esperada === '?') return letra ? 'silenciosa' : 'certa'
  if (esperada === '_') return lida === '?' ? 'certa' : letra ? 'silenciosa' : 'aviso'
  if (esperada === '*') return lida === '*' ? 'certa' : letra ? 'silenciosa' : 'aviso'
  if (lida === esperada) return 'certa'
  return lida === '?' || lida === '*' || lida === '-' ? 'aviso' : 'silenciosa'
}

// CSV simples (sem aspas), como o do dataset/.
function lerCsv(caminho: string): { folhas: Folha[]; problemas: string[] } {
  const linhas = readFileSync(caminho, 'utf-8').replace(/^﻿/, '').split(/\r?\n/)
  const cab = linhas[0].split(',').map((c) => c.trim())
  const folhas: Folha[] = []
  const problemas: string[] = []
  linhas.slice(1).forEach((texto, i) => {
    const campos = texto.split(',')
    const v = (nome: string) => (campos[cab.indexOf(nome)] ?? '').trim()
    // a condição pode ter vírgulas: junta o resto da linha
    const condicao = campos.slice(cab.indexOf('condicao')).join(',')
    const arquivo = v('arquivo')
    if (!arquivo) return
    const n = Number.parseInt(v('n_questoes'))
    const respostas = v('respostas').toUpperCase()
    if (!Number.isInteger(n)) problemas.push(`linha ${i + 2}: n_questoes inválido`)
    else if (respostas.length !== n || /[^ABCDE_*?]/.test(respostas))
      problemas.push(`linha ${i + 2} (${arquivo}): respostas "${respostas}" não batem com ${n} questões A-E/_/*/?`)
    else
      folhas.push({
        arquivo,
        n,
        respostas,
        celular: v('celular') || '(não informado)',
        condicoes: condicao.split(';').map((c) => c.trim().toLowerCase()).filter(Boolean),
      })
  })
  return { folhas, problemas }
}

function porcentagem(parte: number, todo: number) {
  return todo ? `${((100 * parte) / todo).toFixed(1)}%`.padStart(6) : '    - '
}

async function main() {
  const args = process.argv.slice(2)
  const opcao = (nome: string, padrao: string) => {
    const i = args.indexOf(nome)
    return i >= 0 && args[i + 1] ? resolve(args[i + 1]) : padrao
  }
  const iConjunto = args.indexOf('--conjunto')
  const pasta = iConjunto >= 0 && args[iConjunto + 1] ? join(RAIZ, 'dataset', args[iConjunto + 1]) : join(RAIZ, 'dataset')
  const csv = opcao('--csv', join(pasta, 'respostas.csv'))
  const pastaFotos = opcao('--fotos', join(pasta, 'fotos'))

  const { folhas, problemas } = lerCsv(csv)
  for (const p of problemas) console.log('AVISO no CSV:', p)
  if (folhas.length === 0) {
    console.log(`Nenhuma folha em ${csv}. Preencha o CSV conforme o dataset/LEIAME.md.`)
    return 0
  }

  // O pacote é CommonJS: o módulo vem em .default e pode ser uma Promise.
  let cv: CV = (opencv as CV).default ?? opencv
  if (cv instanceof Promise) cv = await cv

  const total: Record<Classe, number> = { certa: 0, aviso: 0, silenciosa: 0 }
  const porGrupo = new Map<string, Record<Classe, number>>()
  const silenciosas: string[] = []
  const faltando: string[] = []
  const tempos: number[] = []
  const leituras: string[] = []
  const detalhes: string[] = []
  let folhasCertas = 0

  console.log(`${'arquivo'.padEnd(40)} ${'esperado'.padEnd(12)} ${'lido'.padEnd(12)} resultado`)
  for (const folha of folhas) {
    const caminho = join(pastaFotos, folha.arquivo)
    if (!existsSync(caminho)) {
      faltando.push(folha.arquivo)
      continue
    }
    // rotate() sem argumento aplica a orientação do EXIF, como o cv2.imread
    const { data, info } = await sharp(caminho).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const pixels = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    // o recorte do quadro-guia já vem em pé e no tamanho certo; a folha
    // inteira pode estar girada ou pequena na foto (procurar)
    const recorte = folha.arquivo.startsWith('recorte-')
    const largura = recorte ? LARGURA_RECORTE : LARGURA_FOLHA
    const t0 = performance.now()
    let r: ReturnType<typeof processar>
    try {
      r = processar(cv, info.width, info.height, pixels, folha.n, largura, !recorte)
    } catch (err) {
      // no app, o worker devolve o erro e a tela mostra "Não consegui ler"
      r = { tipo: 'erro', mensagem: err instanceof Error ? err.message : String(err) }
    }
    tempos.push(performance.now() - t0)
    if (r.tipo === 'erro') console.log(`   ERRO em ${folha.arquivo}: ${r.mensagem}`)
    if (r.tipo === 'pronto') throw new Error(`resposta inesperada em ${folha.arquivo}`)
    if (r.tipo === 'erro') r = { tipo: 'resultado', tempos: {}, total: 0, contornos: 0, circulos: [], grade: null, tabelaCortada: false, ladoIncerto: false, linhasExtras: 0, aneis: [], detectadas: [], respostas: [] }

    // '-': tabela não encontrada; linhas a mais: o app pede para conferir
    const lido = r.linhasExtras
      ? '?'.repeat(folha.n)
      : r.respostas.map((x) => x.letra).join('') || '-'.repeat(folha.n)
    leituras.push(`${folha.arquivo};${lido}`)
    detalhes.push(
      JSON.stringify({
        arquivo: folha.arquivo,
        aneis: r.aneis,
        detectadas: r.detectadas,
        grade: (r.grade ?? []).map((linha) => linha.map(({ x, y, r }) => [x, y, r])),
      }),
    )
    const classes = [...folha.respostas].map((e, i) => classificar(e, lido[i]))
    const grupos = [`celular: ${folha.celular}`, ...folha.condicoes.map((c) => `condição: ${c}`)]
    classes.forEach((c, i) => {
      total[c]++
      for (const g of grupos) {
        if (!porGrupo.has(g)) porGrupo.set(g, { certa: 0, aviso: 0, silenciosa: 0 })
        porGrupo.get(g)![c]++
      }
      if (c === 'silenciosa')
        silenciosas.push(`${folha.arquivo} Q${i + 1}: esperado ${folha.respostas[i]}, lido ${lido[i]}`)
    })

    let situacao = 'ok'
    if (classes.every((c) => c === 'certa')) folhasCertas++
    else {
      const nSil = classes.filter((c) => c === 'silenciosa').length
      const nAv = classes.filter((c) => c === 'aviso').length
      situacao = [
        nSil ? `${nSil} ERRADA(S) SEM AVISO` : '',
        nAv ? `${nAv} com aviso` : '',
        r.respostas.length === 0 ? 'tabela não encontrada' : '',
      ]
        .filter(Boolean)
        .join(', ')
    }
    console.log(`${folha.arquivo.slice(0, 40).padEnd(40)} ${folha.respostas.padEnd(12)} ${lido.padEnd(12)} ${situacao}`)
  }

  const iLeituras = args.indexOf('--leituras')
  if (iLeituras >= 0 && args[iLeituras + 1]) writeFileSync(resolve(args[iLeituras + 1]), leituras.join('\n') + '\n')
  const iDetalhes = args.indexOf('--detalhes')
  if (iDetalhes >= 0 && args[iDetalhes + 1]) writeFileSync(resolve(args[iDetalhes + 1]), detalhes.join('\n') + '\n')
  const questoes = total.certa + total.aviso + total.silenciosa
  console.log()
  console.log(`Folhas lidas: ${tempos.length} (${folhasCertas} totalmente certas)`)
  if (faltando.length) console.log(`Fotos não encontradas em ${pastaFotos}: ${faltando.join(', ')}`)
  if (questoes) {
    const linha = (rotulo: string, n: number, meta: string) =>
      console.log(`  ${rotulo} ${String(n).padStart(4)}  ${porcentagem(n, questoes)}   ${meta}`)
    console.log(`Questões: ${questoes}`)
    linha('certas ...........', total.certa, '(meta: >= 99%)')
    linha('com aviso (? ou *)', total.aviso, '')
    linha('ERRO SILENCIOSO ..', total.silenciosa, '(meta: o mais perto possível de 0)')
    const media = tempos.reduce((a, b) => a + b, 0) / tempos.length
    console.log(`Tempo médio por folha (app no Node, neste PC): ${Math.round(media)} ms`)

    console.log()
    console.log(`${'por celular / condição'.padEnd(40)} ${'questões'.padStart(8)} ${'certas'.padStart(7)} ${'aviso'.padStart(7)} ${'silenc.'.padStart(7)}`)
    for (const g of [...porGrupo.keys()].sort()) {
      const c = porGrupo.get(g)!
      const n = c.certa + c.aviso + c.silenciosa
      console.log(
        `${g.slice(0, 40).padEnd(40)} ${String(n).padStart(8)} ${porcentagem(c.certa, n).padStart(7)} ${porcentagem(c.aviso, n).padStart(7)} ${String(c.silenciosa).padStart(7)}`,
      )
    }
  }
  if (silenciosas.length) {
    console.log()
    console.log('Erros silenciosos (prioridade máxima):')
    for (const s of silenciosas) console.log('  ', s)
  }
  return silenciosas.length ? 1 : 0
}

main().then((codigo) => process.exit(codigo))
