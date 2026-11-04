// Bip ao ler uma folha: um "plim" curto e leve de dois tons subindo quando
// a leitura saiu limpa, e dois tons descendo quando o professor precisa
// conferir (questão em dúvida, tabela cortada ou não encontrada). Assim dá
// para saber sem olhar a tela se a folha precisa de atenção.
//
// O som é gerado pelo navegador (Web Audio), sem arquivo: funciona sem
// internet. No iPhone, o áudio só toca depois de um toque na tela, então
// prepararSom() é chamado nos botões que abrem a câmera e capturam.

export type Tom = 'certo' | 'conferir'
// frequência (Hz), início e duração (s)
export type Nota = { freq: number; inicio: number; duracao: number }

export const NOTAS: Record<Tom, Nota[]> = {
  // lá e mi agudos, subindo
  certo: [
    { freq: 880, inicio: 0, duracao: 0.12 },
    { freq: 1318.5, inicio: 0.09, duracao: 0.22 },
  ],
  // dó e sol mais graves, descendo
  conferir: [
    { freq: 523.3, inicio: 0, duracao: 0.14 },
    { freq: 392, inicio: 0.12, duracao: 0.24 },
  ],
}

// volume de pico (0 a 1): leve, para não assustar numa sala em silêncio
const VOLUME = 0.18
// subida do volume no começo de cada nota (s), para não estalar
const ATAQUE = 0.012
const SILENCIO = 0.0001

const CHAVE_SOM = 'gabarito-livre:som'

type LeituraParaSom = {
  respostas: { letra: string }[]
  tabelaCortada: boolean
  ladoIncerto: boolean
  linhasExtras: number
}

function duvida(letra: string) {
  return letra === '?' || letra === '*'
}

export function tomDaLeitura(leitura: LeituraParaSom | null, nQuestoes: number): Tom {
  if (!leitura || leitura.respostas.length !== nQuestoes) return 'conferir'
  if (leitura.tabelaCortada || leitura.ladoIncerto || leitura.linhasExtras > 0) return 'conferir'
  return leitura.respostas.some((r) => duvida(r.letra)) ? 'conferir' : 'certo'
}

export function somLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== 'nao'
  } catch {
    return true
  }
}

export function guardarSom(ligado: boolean): void {
  try {
    localStorage.setItem(CHAVE_SOM, ligado ? 'sim' : 'nao')
  } catch {
    // só não fica lembrado
  }
}

type ComSessaoDeAudio = Navigator & { audioSession?: { type: string } }
type ComWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext }

let contexto: AudioContext | null = null

function obterContexto(): AudioContext | null {
  if (contexto) return contexto
  const Construtor = globalThis.AudioContext ?? (globalThis as ComWebkit).webkitAudioContext
  if (!Construtor) return null
  try {
    // iPhone: respeita a chave do silencioso e não para a música de outro app
    const sessao = (globalThis.navigator as ComSessaoDeAudio | undefined)?.audioSession
    if (sessao) sessao.type = 'ambient'
    contexto = new Construtor()
  } catch {
    return null
  }
  return contexto
}

function retomar(c: AudioContext) {
  if (c.state === 'suspended') c.resume().catch(() => {})
}

// Chamar dentro de um toque (clique): libera o áudio no iPhone, para a
// captura automática, que acontece sem toque, conseguir tocar depois.
export function prepararSom(): void {
  if (!somLigado()) return
  const c = obterContexto()
  if (!c) return
  try {
    retomar(c)
    // um instante de silêncio: o Safari só libera o áudio depois de tocar algo
    const fonte = c.createBufferSource()
    fonte.buffer = c.createBuffer(1, 1, c.sampleRate)
    fonte.connect(c.destination)
    fonte.start()
  } catch {
    // sem áudio: segue sem o bip
  }
}

export function tocar(tom: Tom): void {
  if (!somLigado()) return
  const c = obterContexto()
  if (!c) return
  try {
    retomar(c)
    const agora = c.currentTime + 0.01
    for (const nota of NOTAS[tom]) {
      const oscilador = c.createOscillator()
      const ganho = c.createGain()
      oscilador.type = 'sine'
      oscilador.frequency.value = nota.freq
      const t0 = agora + nota.inicio
      ganho.gain.setValueAtTime(SILENCIO, t0)
      ganho.gain.exponentialRampToValueAtTime(VOLUME, t0 + ATAQUE)
      ganho.gain.exponentialRampToValueAtTime(SILENCIO, t0 + nota.duracao)
      oscilador.connect(ganho).connect(c.destination)
      oscilador.start(t0)
      oscilador.stop(t0 + nota.duracao + 0.02)
    }
  } catch {
    // sem áudio: segue sem o bip
  }
}
