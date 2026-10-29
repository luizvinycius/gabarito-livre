// Partes do algoritmo de leitura que não dependem do OpenCV (porte do
// group_rows, lattice_angle, side_cue, read_grade e da decisão por linha do
// poc/poc_bolhas.py, seção 3.4 da documentação). Ficam separadas para poderem
// ser testadas sem o worker.

import type { Circulo } from './protocolo'

const LETRAS = 'ABCDE'

// Círculo detectado. redondo: false para as bolinhas achatadas pela
// perspectiva, que não montam a grade: só contam como bolinha detectada numa
// posição que a grade já previu (um "0" do texto da coluna Questão também
// passaria pelo filtro delas).
export type Detectado = Circulo & { redondo?: boolean }

// Forma de uma bolinha na foto: o ponto do ângulo t fica em
// (a cos t + b sin t, c cos t + d sin t) a partir do centro.
export type Forma = [number, number, number, number]
export const formaCirculo = (r: number): Forma => [r, 0, 0, r]

// Posição prevista de uma bolinha: centro, raio equivalente e forma.
export type Posicao = Circulo & { forma: Forma }

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

// Resolve M·h = b (eliminação de Gauss com pivotamento parcial). Lança um
// erro se M for singular.
function resolver(M: number[][], b: number[]): number[] {
  const n = b.length
  const A = M.map((linha, i) => [...linha, b[i]])
  for (let i = 0; i < n; i++) {
    let p = i
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k
    ;[A[i], A[p]] = [A[p], A[i]]
    if (Math.abs(A[i][i]) < 1e-12) throw new Error('grade degenerada')
    for (let k = i + 1; k < n; k++) {
      const f = A[k][i] / A[i][i]
      for (let j = i; j <= n; j++) A[k][j] -= f * A[i][j]
    }
  }
  const h = new Array<number>(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = A[i][n]
    for (let j = i + 1; j < n; j++) s -= A[i][j] * h[j]
    h[i] = s / A[i][i]
  }
  return h
}

// Equações normais (MᵀM)·h = Mᵀb dos mínimos quadrados das linhas de M.
function minimosQuadrados(linhas: number[][], b: number[]): number[] {
  const n = linhas[0].length
  const MtM = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const Mtb = new Array<number>(n).fill(0)
  linhas.forEach((a, k) => {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) MtM[i][j] += a[i] * a[j]
      Mtb[i] += a[i] * b[k]
    }
  })
  return resolver(MtM, Mtb)
}

type Obs = { linha: number; coluna: number; x: number; y: number }
type Prever = (coluna: number, linha: number) => [number, number]

// Grade afim (coluna, linha) → (x, y). null se os pontos estão todos numa
// linha ou numa coluna só.
function ajusteAfim(obs: Obs[]): Prever | null {
  if (obs.length < 3) return null
  try {
    const A = obs.map((o) => [1, o.coluna, o.linha])
    const cx = minimosQuadrados(A, obs.map((o) => o.x))
    const cy = minimosQuadrados(A, obs.map((o) => o.y))
    return (c, l) => [cx[0] + cx[1] * c + cx[2] * l, cy[0] + cy[1] * c + cy[2] * l]
  } catch {
    return null
  }
}

// Grade projetiva (homografia) (coluna, linha) → (x, y): acompanha a
// perspectiva de uma foto inclinada, em que as linhas e as colunas mais perto
// da câmera ficam mais espaçadas (a grade afim escorrega uma linha). Mínimos
// quadrados lineares (DLT com h33 = 1), como o fit_projective do protótipo.
// Precisa de pontos em 3 linhas e 3 colunas; null se não der ou se a
// perspectiva estimada for absurda entre as linhas linhaMin e linhaMax (a
// grade é prevista até nQuestoes linhas fora das detectadas).
function ajusteProjetivo(obs: Obs[], rmed: number, linhaMin: number, linhaMax: number): Prever | null {
  if (obs.length < 6 || new Set(obs.map((o) => o.linha)).size < 3 || new Set(obs.map((o) => o.coluna)).size < 3)
    return null
  const mx = media(obs.map((o) => o.x))
  const my = media(obs.map((o) => o.y))
  const s = 10 * rmed
  const linhas: number[][] = []
  const b: number[] = []
  for (const { coluna: c, linha: l, x } of obs) {
    const X = (x - mx) / s
    linhas.push([c, l, 1, 0, 0, 0, -c * X, -l * X])
    b.push(X)
  }
  for (const { coluna: c, linha: l, y } of obs) {
    const Y = (y - my) / s
    linhas.push([0, 0, 0, c, l, 1, -c * Y, -l * Y])
    b.push(Y)
  }
  let h: number[]
  try {
    h = minimosQuadrados(linhas, b)
  } catch {
    return null
  }
  for (const c of [0, 4]) {
    for (const l of [linhaMin, linhaMax]) {
      const w = h[6] * c + h[7] * l + 1
      if (!(w > 0.5 && w < 2)) return null
    }
  }
  return (c, l) => {
    const w = h[6] * c + h[7] * l + 1
    return [mx + (s * (h[0] * c + h[1] * l + h[2])) / w, my + (s * (h[3] * c + h[4] * l + h[5])) / w]
  }
}

// aneis: pontuação de anel (0 a 5) de cada linha escolhida
// detectadas: bolinhas detectadas em cada linha escolhida (0 a 5)
// colunas: bolinhas detectadas em cada coluna A a E do bloco escolhido,
//   seguidas das redondas na coluna antes da A e na depois da E (7 números)
// linhasExtras: linhas de bolinhas logo acima ou abaixo do bloco escolhido
export type Grade = {
  linhas: Circulo[][]
  aneis: number[]
  detectadas: number[]
  colunas: number[]
  linhasExtras: number
  raio: number
}

// Pontuação mínima de anel (0 a 5) de cada linha escolhida. Nas fotos de
// teste, todas as linhas da tabela tiraram 5,0 e as de fora no máximo 3,6.
// Se alguma linha ficar abaixo do mínimo, a tabela provavelmente está cortada
// e a grade pode estar deslocada: todas as respostas viram '?'.
// TODO: recalibrar com o conjunto de fotos (poc/avaliar.py).
export const ANEL_MINIMO = 4.3
// Linha de bolinhas pequenas ou impressas claras (ver gradeSuspeita): nas
// fotos de longe ou inclinadas, as linhas da tabela ficaram com anel de 3,5 a
// 4,3.
export const ANEL_MINIMO_FRACO = 3.4
export const DETECTADAS_FRACO = 3
// Tabela pequena na foto (lida com a imagem 2x maior): o anel borra e as
// linhas da tabela ficaram com 2,7 a 3,4, mesmo com as 5 bolinhas detectadas
// em todas. Com ao menos DETECTADAS_FORTE detectadas, basta ANEL_MINIMO_DETECTADAS.
export const ANEL_MINIMO_DETECTADAS = 2.5
export const DETECTADAS_FORTE = 4

// Linha da tabela com anel abaixo de ANEL_MINIMO, mas com bolinhas detectadas
// bastantes para o anel dela (ver gradeSuspeita).
const linhaFracaOk = (anel: number, det: number) =>
  (anel >= ANEL_MINIMO_FRACO && det >= DETECTADAS_FRACO) || (anel >= ANEL_MINIMO_DETECTADAS && det >= DETECTADAS_FORTE)

// A pontuação de anel não basta no modelo compacto (grade grossa): lá as
// linhas de "DISSERTATIVA" e o cabeçalho tiram até 5,0. O que separa uma linha
// de bolinhas de uma linha de texto é ter bolinhas detectadas: nas fotos e no
// conjunto sintético, as linhas da tabela costumam ter de 2 a 5 e as de fora,
// 0 (uma linha do meio pode ficar com 0 quando as bolinhas não formam uma
// cadeia de 3). Linha vizinha ao bloco com anel alto e ao menos
// DETECTADAS_EXTRA bolinhas: a tabela tem mais linhas que o gabarito.
export const DETECTADAS_EXTRA = 2

// Folha curvada (correcaoDasColunas): bolinhas de uma coluna para estimar o
// deslocamento dela e passadas do ajuste alternado (ajustarGrade).
const CURVA_MIN_OBS = 3
const CURVA_PASSADAS = 3
// Deslocamento máximo de uma coluna ao longo dela, em passos de linha. No
// conjunto sintético (arco e borda enrolada), a curvatura deu até 0,18; numa
// folha plana, até 0,03; uma coluna com as linhas trocadas, de 0,4 a 0,65.
export const CURVA_MAX = 0.3
// Ligação de uma cadeia que pula uma coluna (cadeiasHorizontais): não vale se
// houver uma bolinha detectada no vão a menos de PULO_VAO da distância típica
// entre vizinhas da reta que liga as duas pontas.
const PULO_VAO = 0.5
// Resgate de uma coluna inteira deslocada (resgatarColuna): raio de busca
// (fração do passo de uma linha), quanto cada bolinha pode se afastar do
// deslocamento mediano (em raios) e quantas bolinhas no mínimo.
const RESGATE_RAIO = 0.45
const RESGATE_COERENCIA = 0.5
const RESGATE_MIN = 3

// Decisão de cada linha: a segunda bolinha mais escura destaca-se da base mais
// que DUPLA do destaque da primeira: duas marcadas. Entre DUPLA_DUVIDA e DUPLA
// (uma segunda marcação mais fraca), é dúvida e o professor confirma; abaixo,
// é rasura leve e vale a primeira.
export const DUPLA = 0.6
export const DUPLA_DUVIDA = 0.4

/**
 * Tabela cortada ou grade deslocada: alguma linha com anel baixo, ou a
 * primeira ou a última linha sem nenhuma bolinha detectada (o bloco
 * provavelmente escorregou para uma linha de texto).
 * Numa foto de longe ou inclinada, com bolinhas pequenas e impressão clara, o
 * anel de uma linha da tabela cai abaixo de ANEL_MINIMO. Ela é aceita com anel
 * a partir de ANEL_MINIMO_FRACO se tiver ao menos DETECTADAS_FRACO bolinhas
 * detectadas, se cada coluna do bloco tiver bolinhas detectadas em ao menos
 * metade das linhas e se as colunas logo antes da A e logo depois da E tiverem
 * bolinhas redondas em menos da metade; com DETECTADAS_FORTE detectadas, a
 * partir de ANEL_MINIMO_DETECTADAS. Com a grade uma coluna para o lado, a
 * coluna que caiu fora da tabela fica sem bolinhas, e a coluna da tabela que
 * ficou de fora do bloco tem as dela.
 */
export function gradeSuspeita({ aneis, detectadas, colunas }: Grade): boolean {
  const n = aneis.length
  const colunasOk =
    colunas.length === 7 && Math.min(...colunas.slice(0, 5)) * 2 >= n && Math.max(...colunas.slice(5)) * 2 < n
  const baixo = aneis.some((a, i) => a < ANEL_MINIMO && !(colunasOk && linhaFracaOk(a, detectadas[i])))
  return baixo || detectadas[0] === 0 || detectadas.at(-1) === 0
}

/**
 * Estima a grade (nQuestoes linhas × 5 colunas) a partir das bolinhas
 * detectadas, mesmo que algumas faltem, e devolve a posição de TODAS elas.
 * anel(p) diz de 0 a 1 quanto a posição p parece uma bolinha impressa, ou
 * null se cair fora da imagem. Devolve null se não encontrar a tabela.
 */
export function agruparLinhas(
  detectados: Detectado[],
  nQuestoes: number,
  anel: (p: Posicao) => number | null,
): Grade | null {
  // 5. fica com os redondos do tamanho dominante
  const redondos = detectados.filter((c) => c.redondo !== false)
  if (redondos.length === 0) return null
  let rmed = mediana(redondos.map((c) => c.r))
  const circulos = redondos.filter((c) => c.r > 0.75 * rmed && c.r < 1.3 * rmed)
  rmed = mediana(circulos.map((c) => c.r))

  const cadeias = cadeiasHorizontais(circulos, rmed)
  if (!cadeias) return null
  const obs = observacoesDasCadeias(cadeias.cadeias, centrosDasColunas(cadeias.cadeias, cadeias.sp), cadeias.sp, rmed)
  if (obs.length < 3) return null
  const ajuste = ajusteComDescarte(obs, rmed, nQuestoes)
  if (!ajuste) return null
  const grade = crescerGrade(ajuste.obs, ajuste.prever, detectados, rmed, nQuestoes)
  const posicao = formaDaGrade(grade.obs, grade.prever, rmed)

  // 10. o professor já informou quantas questões há: escolhe as nQuestoes
  // linhas seguidas com mais evidência. A evidência de cada linha é o número
  // de bolinhas detectadas nela mais a pontuação de anel nas 5 posições
  // previstas. Testa também linhas acima e abaixo das detectadas, porque a
  // questão 1 (ou a última) pode não ter sido detectada.
  const linhasObs = grade.obs.map((o) => o.linha)
  const candidatas = new Map<number, Candidata>()
  for (let l = Math.min(...linhasObs) - nQuestoes; l <= Math.max(...linhasObs) + nQuestoes; l++) {
    const pos = [0, 1, 2, 3, 4].map((c) => posicao(c, l))
    const notas = pos.map(anel)
    if (notas.some((nota) => nota === null)) continue // linha fora da imagem
    const soma = (notas as number[]).reduce((a, b) => a + b, 0)
    const achou = pos.map((p) => detectada(detectados, p).algum)
    // colunas logo antes da A e logo depois da E: com bolinhas redondas, a
    // grade está uma coluna para o lado (ver gradeSuspeita)
    const vizinhas = [posicao(-1, l), posicao(5, l)].map((p) => detectada(detectados, p).redondo)
    candidatas.set(l, { pos, anel: soma, det: achou.filter(Boolean).length, achou: [...achou, ...vizinhas] })
  }
  const bloco = escolherBloco(candidatas, nQuestoes)
  if (!bloco) return null
  const escolhidas = Array.from({ length: nQuestoes }, (_, j) => candidatas.get(bloco.inicio + j)!)

  return {
    linhas: escolhidas.map((c) => c.pos.map(({ x, y, r }) => ({ x, y, r }))),
    aneis: escolhidas.map((c) => c.anel),
    detectadas: escolhidas.map((c) => c.det),
    colunas: [0, 1, 2, 3, 4, 5, 6].map((k) => escolhidas.filter((c) => c.achou[k]).length),
    linhasExtras: bloco.linhasExtras,
    raio: rmed,
  }
}

// Linha candidata do bloco: posições, pontuação de anel (0 a 5), bolinhas
// detectadas e, por coluna A a E, se há bolinha detectada, seguido de se há
// bolinha redonda na coluna antes da A e na depois da E.
type Candidata = { pos: Posicao[]; anel: number; det: number; achou: boolean[] }

// 6. Encadeia vizinhos horizontais (union-find): distância de 2 a 12 raios,
// desnível menor que 0,9 raio. Devolve as cadeias de 3 ou mais bolinhas e o
// espaçamento entre colunas, ou null se não houver cadeia.
function cadeiasHorizontais(circulos: Circulo[], rmed: number): { cadeias: Circulo[][]; sp: number } | null {
  const n = circulos.length
  const pai = circulos.map((_, i) => i)
  const raiz = (i: number): number => {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]]
      i = pai[i]
    }
    return i
  }
  // distância típica até a vizinha mais próxima (o passo de uma linha, em
  // geral): mede quão perto da ligação uma bolinha do vão está
  const vizinha =
    n > 1
      ? mediana(
          circulos.map((c, i) =>
            Math.min(...circulos.filter((_, k) => k !== i).map((o) => Math.hypot(c.x - o.x, c.y - o.y))),
          ),
        )
      : 0
  // A ligação pula uma bolinha detectada que está quase na reta entre as
  // duas pontas: a linha continua por ela, e a ponta j é da linha de baixo
  // ou de cima (folha curvada, r-07).
  const atravessa = (a: Circulo, b: Circulo) =>
    circulos.some(
      (k) =>
        k.x > a.x + 0.25 * (b.x - a.x) &&
        k.x < b.x - 0.25 * (b.x - a.x) &&
        Math.abs(k.y - (a.y + ((b.y - a.y) * (k.x - a.x)) / (b.x - a.x))) < PULO_VAO * vizinha,
    )
  const vaos: number[] = []
  for (let i = 0; i < n; i++) {
    let melhor = -1
    let bd = 1e9
    for (let j = 0; j < n; j++) {
      const dx = circulos[j].x - circulos[i].x
      const dy = Math.abs(circulos[j].y - circulos[i].y)
      if (dx > 2 * rmed && dx < 12 * rmed && dy < 0.9 * rmed && dx < bd && !atravessa(circulos[i], circulos[j])) {
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
  return { cadeias, sp: percentil(vaos, 30) } // espaçamento entre colunas (vizinhos diretos)
}

// 7. x das colunas A a E: agrupa os x de todas as bolinhas das cadeias e fica
// com os 5 grupos vizinhos mais povoados.
function centrosDasColunas(cadeias: Circulo[][], sp: number): number[] {
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
  return grupoX.slice(k0, k0 + 5).map(media)
}

// 8. (linha, coluna, x, y) de cada bolinha das cadeias. As cadeias em ordem
// de y; cada uma fica round(distância / espaçamento) linhas depois da
// anterior. Contar a partir da vizinha, e não da primeira, aguenta a
// perspectiva (linhas mais espaçadas perto da câmera).
function observacoesDasCadeias(cadeias: Circulo[][], centros: number[], sp: number, rmed: number): Obs[] {
  const ordenadas = cadeias
    .map((g) => ({ g, y: media(g.map((c) => c.y)) }))
    .sort((a, b) => a.y - b.y)
  const ys = ordenadas.map((o) => o.y)
  const rsp = ys.length > 1 ? Math.max(mediana(ys.slice(1).map((y, i) => y - ys[i])), rmed) : 4 * rmed
  const obs: Obs[] = []
  let linha = 0
  ordenadas.forEach(({ g }, k) => {
    if (k > 0) linha += Math.round((ys[k] - ys[k - 1]) / rsp)
    for (const { x, y } of g) {
      const d = centros.map((cx) => Math.abs(x - cx))
      const coluna = d.indexOf(Math.min(...d))
      if (d[coluna] < sp * 0.35) obs.push({ linha, coluna, x, y })
    }
  })
  return obs
}

// Grade (coluna, linha) → (x, y): projetiva quando dá, afim quando não, mais
// a correção de cada coluna (correcaoDasColunas) para a folha curvada.
function ajustarGrade(obs: Obs[], rmed: number, nQuestoes: number): Prever | null {
  const ls = obs.map((p) => p.linha)
  const lo = Math.min(...ls) - nQuestoes
  const hi = Math.max(...ls) + nQuestoes
  const plano = (o: Obs[]) => ajusteProjetivo(o, rmed, lo, hi) ?? ajusteAfim(o)
  let base = plano(obs)
  if (!base) return null
  let corr = correcaoDasColunas(obs, base)
  // A base ajustada com as bolinhas da folha curvada se entorta para
  // acompanhá-las e, fora das linhas observadas, escorrega (na r-07, a questão
  // 1 da coluna A caía uma linha acima). Ajustada de novo sem a correção das
  // colunas, ela fica plana e a curvatura fica nas colunas.
  for (let it = 0; it < CURVA_PASSADAS; it++) {
    const c = corr
    const nova = plano(
      obs.map((o) => {
        const [dx, dy] = c(o.coluna, o.linha)
        return { ...o, x: o.x - dx, y: o.y - dy }
      }),
    )
    if (!nova) break
    base = nova
    corr = correcaoDasColunas(obs, base)
  }
  const b = base
  const k = corr
  return (c, l) => {
    const [x, y] = b(c, l)
    const [dx, dy] = k(c, l)
    return [x + dx, y + dy]
  }
}

/**
 * Folha curvada: a homografia supõe papel plano. Numa folha arqueada, o meio
 * de cada linha sobe em relação às pontas (r-02); com a borda do papel
 * enrolada, a coluna E inteira desce meia linha (r-07). Cada coluna com ao
 * menos CURVA_MIN_OBS bolinhas ganha um deslocamento linear ao longo dela
 * (pelos resíduos da grade base, por mínimos quadrados), constante fora das
 * linhas observadas; a coluna sem bolinhas bastantes usa o da coluna mais
 * próxima que tem (empate: a da esquerda). Entre duas colunas (forma das
 * bolinhas), interpolado; antes da A e depois da E, o da A e o da E.
 * Um deslocamento ao longo da coluna maior que CURVA_MAX do passo de uma linha
 * não é curvatura: é a coluna com as linhas trocadas (na r-07, uma cadeia
 * ligou o A da questão 1 ao C e ao D da 2), e a coluna fica sem correção, para
 * o ajuste robusto descartar essas bolinhas. Igual ao column_correction do
 * protótipo.
 */
function correcaoDasColunas(obs: Obs[], base: Prever): Prever {
  const pontos = new Map<number, { l: number; dx: number; dy: number }[]>()
  for (const o of obs) {
    const [px, py] = base(o.coluna, o.linha)
    pontos.set(o.coluna, [...(pontos.get(o.coluna) ?? []), { l: o.linha, dx: o.x - px, dy: o.y - py }])
  }
  type Ajuste = { ax: number; bx: number; ay: number; by: number; lMin: number; lMax: number }
  const ajuste = new Map<number, Ajuste>()
  for (const [c, pts] of pontos) {
    if (pts.length < CURVA_MIN_OBS) continue
    const ls = pts.map((p) => p.l)
    const lm = media(ls)
    const vari = media(ls.map((l) => (l - lm) ** 2))
    const reta = (d: number[]) => {
      const dm = media(d)
      const inc = vari > 0 ? media(ls.map((l, i) => (l - lm) * (d[i] - dm))) / vari : 0
      return [dm - inc * lm, inc]
    }
    const [ax, bx] = reta(pts.map((p) => p.dx))
    const [ay, by] = reta(pts.map((p) => p.dy))
    // deslocamento ao longo da coluna (na direção do passo de uma linha), nas
    // pontas das linhas observadas
    const lMin = Math.min(...ls)
    const lMax = Math.max(...ls)
    const [x0, y0] = base(c, lm)
    const [x1, y1] = base(c, lm + 1)
    const ux = x1 - x0
    const uy = y1 - y0
    const aoLongo = Math.max(...[lMin, lMax].map((l) => Math.abs((ax + bx * l) * ux + (ay + by * l) * uy)))
    if (aoLongo > CURVA_MAX * (ux * ux + uy * uy)) continue
    ajuste.set(c, { ax, bx, ay, by, lMin, lMax })
  }
  if (ajuste.size === 0) return () => [0, 0]
  const colunas = [...ajuste.keys()]
  const porColuna = [0, 1, 2, 3, 4].map(
    (c) =>
      ajuste.get(
        colunas.reduce((m, k) => (Math.abs(k - c) < Math.abs(m - c) || (Math.abs(k - c) === Math.abs(m - c) && k < m) ? k : m)),
      )!,
  )
  const naColuna = (c: number, l: number): [number, number] => {
    const a = porColuna[c]
    const r = Math.min(Math.max(l, a.lMin), a.lMax)
    return [a.ax + a.bx * r, a.ay + a.by * r]
  }
  return (coluna, l) => {
    const ci = Math.min(Math.max(coluna, 0), 4)
    const c0 = Math.min(Math.floor(ci), 3)
    const t = ci - c0
    const [x0, y0] = naColuna(c0, l)
    const [x1, y1] = naColuna(c0 + 1, l)
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
  }
}

// 9. Ajuste da grade descartando pontos fora do padrão. null se não der para
// estimar a grade (tudo numa linha ou numa coluna só).
function ajusteComDescarte(
  inicial: Obs[],
  rmed: number,
  nQuestoes: number,
): { obs: Obs[]; prever: Prever } | null {
  let obs = inicial
  for (let it = 0; it < 3; it++) {
    const p = ajustarGrade(obs, rmed, nQuestoes)
    if (!p) return null
    const res = obs.map((o) => {
      const [x, y] = p(o.coluna, o.linha)
      return Math.hypot(x - o.x, y - o.y)
    })
    const limite = Math.max(0.4 * rmed, percentil(res, 90))
    const manter = obs.filter((_, i) => res[i] < limite)
    if (manter.length === obs.length) break
    obs = manter
    if (obs.length < 3) return null
  }
  const prever = ajustarGrade(obs, rmed, nQuestoes)
  return prever ? { obs, prever } : null
}

// A grade cresce linha a linha: entram os círculos (inclusive os achatados e
// os que ficaram fora das cadeias) que caem numa posição prevista das linhas
// já usadas ou vizinhas, e a grade é reajustada. Numa foto inclinada, só as
// linhas perto da câmera formam cadeias, e a grade projetiva tirada só delas
// erra as linhas do fundo.
function crescerGrade(
  inicial: Obs[],
  previsao: Prever,
  detectados: Detectado[],
  rmed: number,
  nQuestoes: number,
): { obs: Obs[]; prever: Prever } {
  let obs = inicial
  let prever = previsao
  const casar = (p: Prever, l: number, coluna: number): Obs | null => {
    const [x, y] = p(coluna, l)
    let j = -1
    let dj = Infinity
    detectados.forEach((c, i) => {
      const d = Math.hypot(c.x - x, c.y - y)
      if (d < dj) {
        dj = d
        j = i
      }
    })
    if (j < 0) return null
    const c = detectados[j]
    return dj < 0.5 * rmed && c.r > 0.6 * rmed && c.r < 1.6 * rmed ? { linha: l, coluna, x: c.x, y: c.y } : null
  }
  const crescer = () => {
    for (let it = 0; it < nQuestoes; it++) {
      const ls = obs.map((o) => o.linha)
      const lo = Math.min(...ls) - 1
      const hi = Math.max(...ls) + 1
      const novos: Obs[] = []
      for (let l = lo; l <= hi; l++) {
        for (let coluna = 0; coluna < 5; coluna++) {
          const o = casar(prever, l, coluna)
          if (o) novos.push(o)
        }
      }
      if (novos.length <= obs.length) break
      const p = ajustarGrade(novos, rmed, nQuestoes)
      if (!p) break
      obs = novos
      prever = p
    }
  }
  // recomeça o crescimento com as observações o, se der para ajustar a grade
  const recomecar = (o: Obs[]) => {
    const p = ajustarGrade(o, rmed, nQuestoes)
    if (!p) return
    obs = o
    prever = p
    crescer()
  }

  crescer()
  const presentes = new Set(obs.map((o) => o.coluna))
  if (presentes.size === 4 && [0, 1, 2, 3].every((c) => presentes.has(c))) {
    // só 4 colunas nas cadeias, numeradas de 0 a 3: a que falta é a A (folha
    // arqueada, r-07: o A não fica na altura do B de nenhuma linha) ou a E.
    // Fica o lado com mais bolinhas resgatadas.
    const esq = resgatarColuna(obs, prever, detectados, rmed, -1)
    const dir = resgatarColuna(obs, prever, detectados, rmed, 4)
    if (esq.length > dir.length)
      recomecar([...obs.map((o) => ({ ...o, coluna: o.coluna + 1 })), ...esq.map((o) => ({ ...o, coluna: 0 }))])
  }
  const resgatadas = [0, 1, 2, 3, 4].flatMap((c) => resgatarColuna(obs, prever, detectados, rmed, c))
  if (resgatadas.length) recomecar([...obs, ...resgatadas])
  return { obs, prever }
}

// Coluna inteira deslocada (borda do papel enrolada, r-07): as bolinhas dela
// caem a mais de 0,5 raio da posição prevista e nenhuma entra na grade. Nas
// linhas observadas em que a coluna não tem bolinha, procura o círculo mais
// perto a menos de RESGATE_RAIO do passo de uma linha; os que se deslocaram
// como a mediana deles (até RESGATE_COERENCIA raio) entram, se forem ao menos
// RESGATE_MIN. Devolve as observações novas.
function resgatarColuna(obs: Obs[], prever: Prever, detectados: Detectado[], rmed: number, coluna: number): Obs[] {
  const ls = obs.map((o) => o.linha)
  const tem = new Set(obs.filter((o) => o.coluna === coluna).map((o) => o.linha))
  const cand: (Obs & { dx: number; dy: number })[] = []
  for (let l = Math.min(...ls); l <= Math.max(...ls); l++) {
    if (tem.has(l)) continue
    const [x, y] = prever(coluna, l)
    const [x1, y1] = prever(coluna, l + 1)
    let j = -1
    let dj = Infinity
    detectados.forEach((c, i) => {
      const d = Math.hypot(c.x - x, c.y - y)
      if (d < dj) {
        dj = d
        j = i
      }
    })
    if (j < 0) continue
    const c = detectados[j]
    if (dj < RESGATE_RAIO * Math.hypot(x1 - x, y1 - y) && c.r > 0.6 * rmed && c.r < 1.6 * rmed)
      cand.push({ linha: l, coluna, x: c.x, y: c.y, dx: c.x - x, dy: c.y - y })
  }
  if (cand.length < RESGATE_MIN) return []
  const mx = mediana(cand.map((c) => c.dx))
  const my = mediana(cand.map((c) => c.dy))
  const bons = cand
    .filter((c) => Math.hypot(c.dx - mx, c.dy - my) < RESGATE_COERENCIA * rmed)
    .map(({ linha, coluna: col, x, y }) => ({ linha, coluna: col, x, y }))
  return bons.length >= RESGATE_MIN ? bons : []
}

// Posição e forma de cada bolinha: na perspectiva, as bolinhas longe da câmera
// ficam menores e achatadas, na mesma proporção dos passos de uma coluna e de
// uma linha da grade naquele ponto. As bolinhas detectadas (redondas, de raio
// rmed) são a referência. Na grade afim sem inclinação, a forma é o círculo de
// raio rmed em toda a tabela.
function formaDaGrade(obs: Obs[], grade: Prever, rmed: number): (c: number, l: number) => Posicao {
  const eixos = (c: number, l: number) => {
    const [x0, y0] = grade(c - 0.5, l)
    const [x1, y1] = grade(c + 0.5, l)
    const [x2, y2] = grade(c, l - 0.5)
    const [x3, y3] = grade(c, l + 0.5)
    return [x1 - x0, y1 - y0, x3 - x2, y3 - y2]
  }
  const passos = obs.map((o) => eixos(o.coluna, o.linha))
  const refColuna = mediana(passos.map(([cx, cy]) => Math.hypot(cx, cy)))
  const refLinha = mediana(passos.map(([, , lx, ly]) => Math.hypot(lx, ly)))
  return (c, l) => {
    const [x, y] = grade(c, l)
    const [cx, cy, lx, ly] = eixos(c, l)
    const forma: Forma = [(rmed * cx) / refColuna, (rmed * lx) / refLinha, (rmed * cy) / refColuna, (rmed * ly) / refLinha]
    return { x, y, r: Math.sqrt(Math.abs(forma[0] * forma[3] - forma[1] * forma[2])), forma }
  }
}

// Bolinha detectada numa posição: algum círculo detectado perto e de tamanho
// compatível, inclusive os achatados e os que ficaram fora das cadeias.
// redondo: algum deles é redondo.
function detectada(detectados: Detectado[], { x, y, r }: Circulo) {
  const perto = detectados.filter((c) => Math.hypot(c.x - x, c.y - y) < 0.5 * r && c.r > 0.6 * r && c.r < 1.6 * r)
  return { algum: perto.length > 0, redondo: perto.some((c) => c.redondo !== false) }
}

// 10. As nQuestoes linhas seguidas com mais evidência (anel + detectadas).
// Linhas de bolinhas logo acima ou logo abaixo do bloco: a tabela tem mais
// linhas que o gabarito (ex.: folha de 10 questões com gabarito de 8). Aí a
// questão 1 é a primeira linha da tabela: o bloco sobe até ela. Vale também a
// linha fraca que gradeSuspeita aceita: senão, numa foto de longe de uma
// tabela com linhas a mais, o bloco ficaria onde caiu (a questão 1 lida da 2ª
// linha da tabela) sem aviso. null se o bloco não couber.
function escolherBloco(
  candidatas: Map<number, Candidata>,
  nQuestoes: number,
): { inicio: number; linhasExtras: number } | null {
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

  const temBolinhas = (l: number) => {
    const c = candidatas.get(l)
    if (!c) return false
    return (c.anel >= ANEL_MINIMO && c.det >= DETECTADAS_EXTRA) || linhaFracaOk(c.anel, c.det)
  }
  let inicio = s0
  while (temBolinhas(inicio - 1)) inicio--
  let linhasExtras = 0
  for (let l = inicio + nQuestoes; temBolinhas(l); l++) linhasExtras++
  return { inicio, linhasExtras }
}

/**
 * Ângulo (em radianos, de -45° a 45°) dos eixos da grade de bolinhas na foto,
 * pela direção de cada bolinha até a vizinha mais próxima. Como as linhas e as
 * colunas são perpendiculares, a média é feita sobre 4 vezes o ângulo, que dá
 * o mesmo valor para as 4 direções da grade.
 */
export function anguloDaGrade(detectados: Detectado[]): number {
  const redondos = detectados.filter((c) => c.redondo !== false)
  if (redondos.length === 0) return 0
  const rmed = mediana(redondos.map((c) => c.r))
  const pts = redondos.filter((c) => c.r > 0.75 * rmed && c.r < 1.3 * rmed)
  let s4 = 0
  let c4 = 0
  pts.forEach((p, i) => {
    let dx = 0
    let dy = 0
    let bd = 1e9
    pts.forEach((q, j) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (j !== i && d < bd) {
        dx = q.x - p.x
        dy = q.y - p.y
        bd = d
      }
    })
    if (bd > 2 * rmed && bd < 12 * rmed) {
      const t = Math.atan2(dy, dx)
      s4 += Math.sin(4 * t)
      c4 += Math.cos(4 * t)
    }
  })
  return s4 || c4 ? Math.atan2(s4, c4) / 4 : 0
}

// Pista do lado da folha (pistaDoLado): a orientação certa tira a pista mais
// alta. Nas fotos e no conjunto sintético, ela ficou entre 0,3 e 1,0 na
// orientação certa e com o sinal trocado de cabeça para baixo. Abaixo de
// PISTA_MINIMA não dá para saber o lado da folha, e todas as respostas viram
// '?'.
export const PISTA_MINIMA = 0.1
const LADO_DISTANCIAS = [1.3, 1.7, 2.1]
const LADO_PASSOS = Array.from({ length: 21 }, (_, i) => 0.25 + 0.025 * i)
// Um caminho da pista só conta se passar só por papel: o fundo em cada ponto,
// dividido pelo do meio da tabela, a partir de LADO_PAPEL. Nas fotos do grupo,
// o papel ficou de 0,84 a 1,4 e a mesa de madeira, o piso e o pano em volta da
// folha de 0,18 a 0,62: a textura deles imitava as linhas da coluna Questão do
// lado da E, e a pista de uma foto em pé caía para perto de 0.
const LADO_PAPEL = 0.75
// A foto como está (sem girar 90° ou 180°) só perde para outra orientação se
// a pista dela for maior por mais que esta margem.
const MARGEM_EM_PE = 0.05

/**
 * Pista do lado da folha: as linhas que separam as questões continuam pela
 * coluna "Questão", que fica do lado da coluna A; do lado da E, depois da
 * borda da tabela, não há linha nenhuma. Para cada vão entre duas linhas da
 * grade, mede o contraste (mais escuro menos mais claro) no meio do caminho
 * entre elas, a 1,3, 1,7 e 2,1 colunas antes da A e depois da E. Devolve o
 * contraste do lado da A menos o do lado da E: positivo com a folha na
 * orientação certa, negativo de cabeça para baixo. A borda do papel, paralela
 * às colunas, não cria esse contraste. Os caminhos que saem do papel não
 * contam (LADO_PAPEL): a textura de uma mesa ou de um piso em volta da folha
 * cria contraste.
 * escuro(px, py): escuridão (0 a 1) do pixel, ou null fora da imagem.
 * fundo(px, py): cinza do papel em volta do pixel (a mediana larga da
 * normalização da luz), dentro da imagem.
 */
export function pistaDoLado(
  linhas: Circulo[][],
  escuro: (px: number, py: number) => number | null,
  fundo: (px: number, py: number) => number = () => 1,
): number {
  const todas = linhas.flat()
  const papel =
    LADO_PAPEL * fundo(Math.trunc(media(todas.map((c) => c.x))), Math.trunc(media(todas.map((c) => c.y))))
  const lado = (col: number, sinal: number): number | null => {
    const vals: number[] = []
    for (let i = 0; i + 1 < linhas.length; i++) {
      const a = linhas[i]
      const b = linhas[i + 1]
      // passo de uma coluna na ponta (A→B ou D→E), e não a média da linha:
      // numa folha arqueada, a linha desce perto da A e da E, e a média
      // mandava o caminho para longe da linha da questão (r-07: pista 0,02 em
      // pé)
      const [p, q] = col === 0 ? [a[0], a[1]] : [a[3], a[4]]
      const ux = q.x - p.x
      const uy = q.y - p.y
      const { x: x0, y: y0 } = a[col]
      const { x: x1, y: y1 } = b[col]
      for (const t of LADO_DISTANCIAS) {
        const ox = x0 + sinal * t * ux
        const oy = y0 + sinal * t * uy
        const perfil: number[] = []
        for (const s of LADO_PASSOS) {
          const px = Math.trunc(ox + (x1 - x0) * s)
          const py = Math.trunc(oy + (y1 - y0) * s)
          const e = escuro(px, py)
          if (e === null || fundo(px, py) < papel) break
          perfil.push(e)
        }
        if (perfil.length === LADO_PASSOS.length) vals.push(Math.max(...perfil) - Math.min(...perfil))
      }
    }
    return vals.length ? media(vals) : null
  }
  // Um lado fora da foto (tabela encostada na borda) conta como sem linhas:
  // se o lado que sobrou é o da A, a pista continua clara; se é o da E, fica
  // perto de 0 e a leitura pede confirmação.
  return (lado(0, -1) ?? 0) - (lado(4, 1) ?? 0)
}

/**
 * Grade da tabela nas 4 orientações (procurar) ou só na foto como está.
 * anel(x, y, forma): pontuação de anel da posição na imagem.
 * escuro(px, py) e fundo(px, py): escuridão do pixel e cinza do papel em
 * volta, para a pista do lado da folha.
 * ladoIncerto: achou a tabela, mas não o lado da folha.
 */
export function lerGrade(
  detectados: Detectado[],
  nQuestoes: number,
  anel: (x: number, y: number, forma: Forma) => number | null,
  escuro: (px: number, py: number) => number | null,
  procurar: boolean,
  fundo: (px: number, py: number) => number = () => 1,
): { grade: Grade | null; ladoIncerto: boolean } {
  // A grade é montada com as posições giradas de -a; o anel e as posições
  // finais voltam para a imagem girando de +a.
  const naOrientacao = (a: number) => {
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const girados = detectados.map((c) => ({ ...c, x: c.x * cos + c.y * sin, y: -c.x * sin + c.y * cos }))
    const g = agruparLinhas(girados, nQuestoes, ({ x, y, forma: [fa, fb, fc, fd] }) =>
      anel(x * cos - y * sin, x * sin + y * cos, [
        fa * cos - fc * sin,
        fb * cos - fd * sin,
        fa * sin + fc * cos,
        fb * sin + fd * cos,
      ]),
    )
    const grade = g && {
      ...g,
      linhas: g.linhas.map((linha) => linha.map(({ x, y, r }) => ({ x: x * cos - y * sin, y: x * sin + y * cos, r }))),
    }
    const valida = !!grade && !gradeSuspeita(grade)
    const pista = grade && valida && procurar ? pistaDoLado(grade.linhas, escuro, fundo) : 0
    return { grade, valida, pista }
  }

  if (!procurar) return { grade: naOrientacao(0).grade, ladoIncerto: false }
  const phi = anguloDaGrade(detectados)
  const tentativas = [0, 1, 2, 3].map((k) => naOrientacao(phi + (k * Math.PI) / 2))
  const validas = [0, 1, 2, 3].filter((k) => tentativas[k].valida)
  if (validas.length === 0) return { grade: tentativas[0].grade, ladoIncerto: false }
  let k = validas.reduce((m, i) => (tentativas[i].pista > tentativas[m].pista ? i : m))
  // na dúvida pequena, a foto como está
  if (validas.includes(0) && tentativas[0].pista >= tentativas[k].pista - MARGEM_EM_PE) k = 0
  return { grade: tentativas[k].grade, ladoIncerto: tentativas[k].pista < PISTA_MINIMA }
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
  if (segundo - base > DUPLA * vao) return '*'
  if (segundo - base > DUPLA_DUVIDA * vao) return '?' // forte demais para rasura: o professor confirma
  return LETRAS[ordem[0]]
}
