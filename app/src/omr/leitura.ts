// Partes do algoritmo de leitura que não dependem do OpenCV (porte do
// group_rows e da decisão por linha do poc/poc_bolhas.py, seção 3.4 da
// documentação). Ficam separadas para poderem ser testadas sem o worker.

import type { Circulo } from './protocolo'

const LETRAS = 'ABCDE'

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Percentil com interpolação linear, igual ao np.percentile.
function percentil(v: number[], p: number): number {
  const s = [...v].sort((a, b) => a - b)
  const pos = ((s.length - 1) * p) / 100
  const i = Math.floor(pos)
  return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * (pos - i) : s[i]
}

function media(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length
}

// Mínimos quadrados para z ≈ c0 + c1·coluna + c2·linha (equações normais 3×3).
function ajustar(obs: Obs[], z: (o: Obs) => number): [number, number, number] {
  const M = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
  for (const o of obs) {
    const a = [1, o.coluna, o.linha]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) M[i][j] += a[i] * a[j]
      M[i][3] += a[i] * z(o)
    }
  }
  // eliminação de Gauss com pivotamento parcial
  for (let i = 0; i < 3; i++) {
    let p = i
    for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k
    ;[M[i], M[p]] = [M[p], M[i]]
    if (Math.abs(M[i][i]) < 1e-9) throw new Error('grade degenerada')
    for (let k = i + 1; k < 3; k++) {
      const f = M[k][i] / M[i][i]
      for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j]
    }
  }
  const c = [0, 0, 0]
  for (let i = 2; i >= 0; i--) {
    let s = M[i][3]
    for (let j = i + 1; j < 3; j++) s -= M[i][j] * c[j]
    c[i] = s / M[i][i]
  }
  return [c[0], c[1], c[2]]
}

type Obs = { linha: number; coluna: number; x: number; y: number }

// aneis: pontuação de anel (0 a 5) de cada linha escolhida
export type Grade = { linhas: Circulo[][]; aneis: number[]; raio: number }

// Pontuação mínima de anel (0 a 5) de cada linha escolhida. Nas fotos de
// teste, todas as linhas da tabela tiraram 5,0 e as de fora no máximo 3,6.
// Se alguma linha ficar abaixo do mínimo, a tabela provavelmente está cortada
// e a grade pode estar deslocada: todas as respostas viram '?'.
// TODO: recalibrar com o conjunto de fotos (poc/avaliar.py).
export const ANEL_MINIMO = 4.3

/**
 * Estima a grade (nQuestoes linhas × 5 colunas) a partir das bolinhas
 * detectadas, mesmo que algumas faltem, e devolve a posição de TODAS elas.
 * anel(c) diz de 0 a 1 quanto a posição c parece uma bolinha impressa, ou
 * null se cair fora da imagem. Devolve null se não encontrar a tabela.
 */
export function agruparLinhas(
  detectados: Circulo[],
  nQuestoes: number,
  anel: (c: Circulo) => number | null,
): Grade | null {
  if (detectados.length === 0) return null
  // 5. fica com o tamanho dominante
  let rmed = mediana(detectados.map((c) => c.r))
  const circulos = detectados.filter((c) => c.r > 0.75 * rmed && c.r < 1.3 * rmed)
  rmed = mediana(circulos.map((c) => c.r))
  const n = circulos.length

  // 6. encadeia vizinhos horizontais (union-find)
  const pai = circulos.map((_, i) => i)
  const raiz = (i: number): number => {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]]
      i = pai[i]
    }
    return i
  }
  const vaos: number[] = []
  for (let i = 0; i < n; i++) {
    let melhor = -1
    let bd = 1e9
    for (let j = 0; j < n; j++) {
      const dx = circulos[j].x - circulos[i].x
      const dy = Math.abs(circulos[j].y - circulos[i].y)
      if (dx > 2 * rmed && dx < 12 * rmed && dy < 0.9 * rmed && dx < bd) {
        melhor = j
        bd = dx
      }
    }
    if (melhor >= 0) {
      pai[raiz(i)] = raiz(melhor)
      vaos.push(bd)
    }
  }
  const grupos = new Map<number, Circulo[]>()
  circulos.forEach((c, i) => {
    const r = raiz(i)
    grupos.set(r, [...(grupos.get(r) ?? []), c])
  })
  const cadeias = [...grupos.values()].filter((g) => g.length >= 3)
  if (cadeias.length === 0) return null
  const sp = percentil(vaos, 30) // espaçamento entre colunas (vizinhos diretos)

  // 7. colunas: agrupa os x e fica com as 5 colunas vizinhas mais povoadas
  const xs = cadeias.flat().map((c) => c.x).sort((a, b) => a - b)
  const grupoX: number[][] = [[xs[0]]]
  for (const x of xs.slice(1)) {
    const atual = grupoX[grupoX.length - 1]
    if (x - atual[atual.length - 1] < sp / 2) atual.push(x)
    else grupoX.push([x])
  }
  const qtd = grupoX.map((g) => g.length)
  let k0 = 0
  let melhorSoma = -1
  for (let k = 0; k < Math.max(1, grupoX.length - 4); k++) {
    const s = qtd.slice(k, k + 5).reduce((a, b) => a + b, 0)
    if (s > melhorSoma) {
      melhorSoma = s
      k0 = k
    }
  }
  const centros = grupoX.slice(k0, k0 + 5).map(media)

  // 8. linhas: y médio de cada cadeia dividido pelo espaçamento entre linhas
  const ys = cadeias.map((g) => media(g.map((c) => c.y))).sort((a, b) => a - b)
  const rsp = ys.length > 1 ? mediana(ys.slice(1).map((y, i) => y - ys[i])) : 4 * rmed
  let obs: Obs[] = []
  for (const g of cadeias) {
    const linha = Math.round((media(g.map((c) => c.y)) - ys[0]) / rsp)
    for (const { x, y } of g) {
      const d = centros.map((cx) => Math.abs(x - cx))
      const coluna = d.indexOf(Math.min(...d))
      if (d[coluna] < sp * 0.35) obs.push({ linha, coluna, x, y })
    }
  }
  if (obs.length < 3) return null

  // 9. ajuste afim (linha, coluna) → (x, y), descartando pontos fora do padrão
  let cx = ajustar(obs, (o) => o.x)
  let cy = ajustar(obs, (o) => o.y)
  const prever = (c: [number, number, number], coluna: number, linha: number) =>
    c[0] + c[1] * coluna + c[2] * linha
  for (let it = 0; it < 3; it++) {
    const res = obs.map((o) =>
      Math.hypot(prever(cx, o.coluna, o.linha) - o.x, prever(cy, o.coluna, o.linha) - o.y),
    )
    const limite = Math.max(0.4 * rmed, percentil(res, 90))
    const manter = obs.filter((_, i) => res[i] < limite)
    if (manter.length === obs.length) break
    obs = manter
    if (obs.length < 3) return null
    cx = ajustar(obs, (o) => o.x)
    cy = ajustar(obs, (o) => o.y)
  }

  // 10. o professor já informou quantas questões há: escolhe as nQuestoes
  // linhas seguidas com mais evidência. A evidência de cada linha é o número
  // de bolinhas detectadas nela mais a pontuação de anel nas 5 posições
  // previstas. Testa também linhas acima e abaixo das detectadas, porque a
  // questão 1 (ou a última) pode não ter sido detectada.
  const linhasObs = obs.map((o) => o.linha)
  const rMin = Math.min(...linhasObs)
  const rMax = Math.max(...linhasObs)
  const detectadas = new Map<number, number>()
  for (const l of linhasObs) detectadas.set(l, (detectadas.get(l) ?? 0) + 1)
  const candidatas = new Map<number, { pos: Circulo[]; anel: number; det: number }>()
  for (let linha = rMin - nQuestoes; linha <= rMax + nQuestoes; linha++) {
    const pos = [0, 1, 2, 3, 4].map((coluna) => ({
      x: prever(cx, coluna, linha),
      y: prever(cy, coluna, linha),
      r: rmed,
    }))
    const notas = pos.map(anel)
    if (notas.some((n) => n === null)) continue // linha fora da imagem
    const soma = (notas as number[]).reduce((a, b) => a + b, 0)
    candidatas.set(linha, { pos, anel: soma, det: detectadas.get(linha) ?? 0 })
  }
  let s0: number | null = null
  let melhor = -Infinity
  for (const k of candidatas.keys()) {
    let soma = 0
    let completo = true
    for (let j = 0; j < nQuestoes && completo; j++) {
      const c = candidatas.get(k + j)
      if (c) soma += c.anel + c.det
      else completo = false
    }
    if (completo && soma > melhor) {
      melhor = soma
      s0 = k
    }
  }
  if (s0 === null) return null
  const escolhidas = Array.from({ length: nQuestoes }, (_, j) => candidatas.get(s0 + j)!)
  return { linhas: escolhidas.map((c) => c.pos), aneis: escolhidas.map((c) => c.anel), raio: rmed }
}

/**
 * 13. Decide a resposta de uma linha a partir do preenchimento (0 a 1) de cada
 * bolinha: a letra, '?' (em branco ou incerto) ou '*' (duas marcadas).
 */
export function decidir(preenchimento: number[]): string {
  const ordem = preenchimento.map((_, i) => i).sort((a, b) => preenchimento[b] - preenchimento[a])
  const topo = preenchimento[ordem[0]]
  const segundo = preenchimento[ordem[1]]
  const base = mediana(preenchimento)
  const vao = topo - base
  if (vao < 0.15) return '?'
  if (segundo - base > 0.6 * vao) return '*'
  return LETRAS[ordem[0]]
}
