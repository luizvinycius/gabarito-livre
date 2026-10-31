// Página de teste da leitura no celular (seção 8.5 da documentação), o
// "modo de desenvolvedor" (endereço com #teste). Lê uma foto ou o quadro da
// câmera (com a captura automática do app), mostra as respostas lidas e
// quanto tempo cada etapa levou, e envia a captura (imagem, leitura e o log
// do quadro ao vivo) para o repositório privado de capturas (envio.ts).

import { useCallback, useRef, useState } from 'react'
import type { Circulo, RespostaLida } from '../omr/protocolo'
import { type Foto, LARGURA_RECORTE, desenharFoto, desenharLeitura, larguraDoArquivo } from '../omr/imagem'
import { type Leitura, useLeitor } from '../omr/useLeitor'
import type { TentativaQuadro } from '../captura'
import Camera from '../Camera'
import { entregarArquivo } from '../arquivo'
import {
  type ConfigEnvio,
  apelidoPadrao,
  configSalva,
  conferirRepositorio,
  enviarArquivos,
  limparApelido,
  pastaDaCaptura,
  salvarConfig,
  textoEmBytes,
} from '../envio'

function textoRespostas(respostas: RespostaLida[]) {
  return respostas.length ? respostas.map((r) => r.letra).join('') : '(tabela não encontrada)'
}

// idaEVolta: da tela até a resposta do worker (preparo + leitura + espera)
type Medicao = Leitura & { idaEVolta: number }

// A imagem que a leitura recebeu, de onde veio e as leituras do quadro ao
// vivo até a captura.
type Captura = {
  arquivo: File
  origem: 'camera-automatica' | 'camera-manual' | 'galeria'
  quando: Date
  nQuestoes: number
  leituraAutomatica?: Leitura
  log: TentativaQuadro[]
}

type EstadoEnvio =
  | { estado: 'parado' }
  | { estado: 'enviando' }
  | { estado: 'enviado'; url: string }
  | { estado: 'erro'; mensagem: string }

// Leituras do quadro ao vivo guardadas para o log (~1 minuto de câmera).
const LOG_MAX = 300

// Nome do arquivo do recorte salvo para o conjunto de teste (dataset/).
function nomeRecorte(nQuestoes: number) {
  const agora = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const data = `${agora.getFullYear()}${p(agora.getMonth() + 1)}${p(agora.getDate())}`
  const hora = `${p(agora.getHours())}${p(agora.getMinutes())}${p(agora.getSeconds())}`
  return `recorte-${nQuestoes}q-${data}-${hora}.jpg`
}

function ms(n: number) {
  return `${Math.round(n)} ms`
}

// O que a ida e volta gasta fora das etapas medidas: a fila até o worker, a
// volta da resposta e a tela ocupada.
function espera(m: Medicao) {
  return m.idaEVolta - m.preparo - m.total
}

const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas
const circulo = ({ x, y, r }: Circulo) => [arred(x, 1), arred(y, 1), arred(r, 1)]

// O que vai para o dados.json de uma leitura (números arredondados).
function resumo(l: Leitura) {
  return {
    letras: textoRespostas(l.respostas),
    preenchimento: l.respostas.map((r) => r.preenchimento.map((p) => arred(p))),
    aneis: l.aneis.map((a) => arred(a)),
    detectadas: l.detectadas,
    tabelaCortada: l.tabelaCortada,
    ladoIncerto: l.ladoIncerto,
    linhasExtras: l.linhasExtras,
    tempos: Object.fromEntries(Object.entries(l.tempos).map(([k, v]) => [k, arred(v, 1)])),
    total: arred(l.total, 1),
    preparo: arred(l.preparo, 1),
    contornos: l.contornos,
    circulos: l.circulos.map(circulo),
    grade: l.grade?.map((linha) => linha.map(circulo)) ?? null,
  }
}

// Quantas leituras do quadro ao vivo ficaram em cada estado.
function contagemDoLog(log: TentativaQuadro[]) {
  const n: Record<string, number> = {}
  for (const t of log) n[t.estado] = (n[t.estado] ?? 0) + 1
  return Object.entries(n)
    .map(([estado, k]) => `${estado} ${k}`)
    .join(', ')
}

export default function PaginaTeste() {
  const leitor = useLeitor()
  const { ler } = leitor
  const canvas = useRef<HTMLCanvasElement>(null)
  const imagem = useRef<Foto | null>(null)
  const log = useRef<TentativaQuadro[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [medicoes, setMedicoes] = useState<Medicao[]>([])
  const [nQuestoes, setNQuestoes] = useState(8)
  // A câmera fica ligada (só escondida) entre uma folha e outra: religar
  // a câmera faz o Safari pedir permissão de novo.
  const [camera, setCamera] = useState<'desligada' | 'visivel' | 'escondida'>('desligada')
  // A captura já em JPEG: o compartilhamento no iPhone só funciona se for
  // chamado direto no toque, sem esperar a conversão.
  const [captura, setCaptura] = useState<Captura | null>(null)
  const [config, setConfig] = useState<ConfigEnvio>(configSalva)
  // a configuração do envio começa aberta se ainda não há token; depois quem
  // abre e fecha é o usuário (senão fecharia ao digitar o 1º caractere)
  const [envioAberto] = useState(() => !config.token)
  const [conexao, setConexao] = useState<{ ok: boolean; texto: string } | null>(null)
  const [respostasReais, setRespostasReais] = useState('')
  const [observacao, setObservacao] = useState('')
  const [envio, setEnvio] = useState<EstadoEnvio>({ estado: 'parado' })

  const erroMostrado = erro ?? leitor.erro

  async function rodar() {
    const foto = imagem.current
    if (!foto) return
    desenharFoto(canvas.current, foto)
    setErro(null)
    setOcupado(true)
    const t0 = performance.now()
    try {
      const r = await ler(foto, nQuestoes)
      setMedicoes((anteriores) => [...anteriores, { ...r, idaEVolta: performance.now() - t0 }])
      desenharLeitura(canvas.current, r.circulos, r.grade, r.respostas)
    } catch (err) {
      setErro(`Falha na leitura: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setOcupado(false)
    }
  }

  function usarImagem(nova: Foto) {
    const anterior = imagem.current?.fonte
    if (anterior instanceof ImageBitmap) anterior.close()
    imagem.current = nova
    setCaptura(null)
    setEnvio({ estado: 'parado' })
    setRespostasReais('')
    setObservacao('')
    setMedicoes([])
    void rodar()
  }

  function abrirCamera() {
    log.current = []
    setCamera('visivel')
  }

  const analisar = useCallback(
    (recorte: HTMLCanvasElement) => ler({ fonte: recorte, largura: LARGURA_RECORTE }, nQuestoes),
    [ler, nQuestoes],
  )

  function registrarTentativa(t: TentativaQuadro) {
    log.current.push(t)
    if (log.current.length > LOG_MAX) log.current.shift()
  }

  function capturou(recorte: HTMLCanvasElement, leitura?: Leitura) {
    setCamera('escondida')
    const doQuadro = [...log.current]
    usarImagem({ fonte: recorte, largura: LARGURA_RECORTE })
    const nome = nomeRecorte(nQuestoes)
    recorte.toBlob(
      (blob) =>
        blob &&
        setCaptura({
          arquivo: new File([blob], nome, { type: 'image/jpeg' }),
          origem: leitura ? 'camera-automatica' : 'camera-manual',
          quando: new Date(),
          nQuestoes,
          leituraAutomatica: leitura,
          log: doQuadro,
        }),
      'image/jpeg',
      0.92,
    )
  }

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      usarImagem({ fonte: await createImageBitmap(arquivo), largura: larguraDoArquivo(arquivo.name) })
      setCaptura({ arquivo, origem: 'galeria', quando: new Date(), nQuestoes, log: [] })
    } catch (err) {
      setErro(`Não consegui abrir a foto: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function salvarRecorte() {
    if (!captura) return
    try {
      await entregarArquivo(captura.arquivo)
    } catch (err) {
      setErro(`Não consegui salvar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function mudarConfig(c: ConfigEnvio) {
    setConfig(c)
    salvarConfig(c)
    setConexao(null)
  }

  async function testarConexao() {
    setConexao({ ok: true, texto: 'Conferindo…' })
    try {
      const repo = await conferirRepositorio(config)
      setConexao({ ok: true, texto: `✅ ${repo}: privado e com permissão de escrita.` })
    } catch (err) {
      setConexao({ ok: false, texto: err instanceof Error ? err.message : String(err) })
    }
  }

  const ultima = medicoes.at(-1)
  // apelido deste aparelho no nome da pasta; sem apelido, um palpite pelo
  // navegador (que não diz o modelo do celular)
  const apelido = limparApelido(config.apelido) || apelidoPadrao(navigator.userAgent)
  const pastaDe = (c: Captura) => pastaDaCaptura(c.quando, c.nQuestoes, apelido)

  // Nome da imagem na pasta da captura: o recorte da câmera ou a foto da
  // galeria com a extensão dela.
  function nomeDaImagem(c: Captura) {
    return c.origem === 'galeria' ? `foto${c.arquivo.name.match(/\.\w+$/)?.[0].toLowerCase() ?? '.jpg'}` : 'recorte.jpg'
  }

  function dadosDaCaptura(c: Captura, l: Medicao) {
    return {
      versaoDoApp: __VERSAO__,
      quando: c.quando.toISOString(),
      origem: c.origem,
      nQuestoes: c.nQuestoes,
      respostasReais: respostasReais || null,
      observacao: observacao.trim() || null,
      imagem: { arquivo: nomeDaImagem(c), nomeOriginal: c.arquivo.name, bytes: c.arquivo.size },
      aparelho: {
        apelido,
        navegador: navigator.userAgent,
        tela: [screen.width, screen.height],
        escala: devicePixelRatio,
      },
      opencv: leitor.carga && { versao: leitor.carga.versao, carregouEmMs: Math.round(leitor.carga.ms) },
      leitura: { ...resumo(l), idaEVolta: arred(l.idaEVolta, 1) },
      leituraAutomatica: c.leituraAutomatica ? resumo(c.leituraAutomatica) : null,
      logDaCaptura: c.log,
    }
  }

  async function enviar() {
    if (!captura || !ultima) return
    setEnvio({ estado: 'enviando' })
    try {
      const nome = nomeDaImagem(captura)
      const url = await enviarArquivos(
        config,
        pastaDe(captura),
        [
          { caminho: nome, bytes: new Uint8Array(await captura.arquivo.arrayBuffer()) },
          { caminho: 'dados.json', bytes: textoEmBytes(JSON.stringify(dadosDaCaptura(captura, ultima), null, 1)) },
        ],
        `captura ${captura.nQuestoes}q (${captura.origem}, ${apelido}): ${textoRespostas(ultima.respostas)}`,
      )
      setEnvio({ estado: 'enviado', url })
    } catch (err) {
      setEnvio({ estado: 'erro', mensagem: err instanceof Error ? err.message : String(err) })
    }
  }

  async function salvarDados() {
    if (!captura || !ultima) return
    const json = JSON.stringify(dadosDaCaptura(captura, ultima), null, 1)
    const nome = `dados-${pastaDe(captura).split('/').slice(1).join('-')}.json`
    try {
      await entregarArquivo(new File([json], nome, { type: 'application/json' }))
    } catch (err) {
      setErro(`Não consegui salvar: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const relatorio = [
    `Navegador: ${navigator.userAgent}`,
    `Versão do app: ${__VERSAO__}`,
    leitor.carga ? `OpenCV ${leitor.carga.versao} carregou em ${ms(leitor.carga.ms)}` : 'OpenCV não carregou',
    ...medicoes.map(
      (m, i) =>
        `Rodada ${i + 1}: total ${ms(m.idaEVolta)} ` +
        `(preparo ${ms(m.preparo)}, worker ${ms(m.total)}, espera ${ms(espera(m))}), ` +
        `${m.circulos.length} círculos em ${m.contornos} contornos`,
    ),
    ...(ultima ? [`Respostas lidas: ${textoRespostas(ultima.respostas)}`] : []),
    ...(ultima?.tabelaCortada ? ['Aviso: tabela cortada'] : []),
    ...(ultima?.ladoIncerto ? ['Aviso: lado da folha incerto'] : []),
    ...(ultima?.linhasExtras ? [`Aviso: ${ultima.linhasExtras} linha(s) a mais que o gabarito`] : []),
    ...(ultima ? [`Anéis por linha: ${ultima.aneis.map((a) => a.toFixed(1)).join(' ')}`] : []),
    ...(ultima ? [`Bolinhas detectadas por linha: ${ultima.detectadas.join(' ')}`] : []),
    ...(ultima?.respostas ?? []).flatMap((r, i) =>
      r.letra === '?' || r.letra === '*'
        ? [`Dúvida Q${i + 1}: ${r.preenchimento.map((p) => p.toFixed(2)).join(' ')}`]
        : [],
    ),
    ...(captura?.log.length ? [`Quadro ao vivo: ${captura.log.length} leituras (${contagemDoLog(captura.log)})`] : []),
  ].join('\n')

  const respostasOk = !respostasReais || respostasReais.length === (captura?.nQuestoes ?? nQuestoes)

  return (
    <main>
      <header className="topo">
        <h1>Teste da leitura</h1>
        <a className="chip" href="#">
          ← App
        </a>
      </header>

      {camera !== 'desligada' && (
        <section className="cartao" hidden={camera === 'escondida'}>
          <Camera
            nQuestoes={nQuestoes}
            visivel={camera === 'visivel'}
            exigirTroca={false}
            analisar={leitor.pronto ? analisar : undefined}
            onTentativa={registrarTentativa}
            onFechar={() => setCamera('desligada')}
            onCapturar={capturou}
          />
        </section>
      )}

      <section className="cartao" hidden={camera === 'visivel'}>
        {erroMostrado && <p className="erro">{erroMostrado}</p>}
        {leitor.carga ? (
          <p>
            ✅ OpenCV {leitor.carga.versao} carregado em <strong>{ms(leitor.carga.ms)}</strong> · app{' '}
            <code>{__VERSAO__}</code>
          </p>
        ) : (
          !erroMostrado && <p>⏳ Carregando o OpenCV (cerca de 13 MB)…</p>
        )}

        <label className="campo">
          Número de questões
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={nQuestoes}
            onChange={(e) => setNQuestoes(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          />
        </label>

        <button className="botao" disabled={!leitor.pronto || ocupado} onClick={abrirCamera}>
          📷 {camera === 'escondida' ? 'Próxima folha' : 'Abrir câmera'}
        </button>
        {camera === 'escondida' && (
          <button className="botao secundario" onClick={() => setCamera('desligada')}>
            Desligar câmera
          </button>
        )}
        <label className={`botao secundario ${!leitor.pronto || ocupado ? 'desativado' : ''}`}>
          🖼️ Escolher foto da galeria
          <input
            type="file"
            accept="image/*"
            disabled={!leitor.pronto || ocupado}
            onChange={(e) => escolherFoto(e.target.files?.[0])}
          />
        </label>
        {medicoes.length > 0 && (
          <button className="botao secundario" disabled={ocupado} onClick={() => void rodar()}>
            🔁 Rodar de novo
          </button>
        )}
        {ocupado && <p>⏳ Processando…</p>}
      </section>

      {ultima && (
        <section className="cartao">
          <h2>Respostas lidas</h2>
          {ultima.respostas.length === 0 && (
            <p className="erro">Não encontrei a tabela de respostas nesta foto.</p>
          )}
          {ultima.tabelaCortada && (
            <p className="erro">
              A tabela parece estar cortada ou fora do quadro. Afaste um pouco o celular e tente de
              novo.
            </p>
          )}
          {ultima.ladoIncerto && (
            <p className="erro">
              Achei a tabela, mas não consegui saber de que lado a folha está. Tire a foto com a folha
              em pé.
            </p>
          )}
          {ultima.linhasExtras > 0 && (
            <p className="erro">
              A tabela parece ter {nQuestoes + ultima.linhasExtras} questões, e não {nQuestoes}. As
              respostas abaixo são das {nQuestoes} primeiras linhas.
            </p>
          )}
          {ultima.respostas.length > 0 && (
            <ol className="respostas">
              {ultima.respostas.map((r, i) => (
                <li key={i} className={r.letra === '?' || r.letra === '*' ? 'duvida' : ''}>
                  <span>{i + 1}</span>
                  <strong>{r.letra}</strong>
                </li>
              ))}
            </ol>
          )}
          <p className="dica">
            <strong>?</strong> = em branco ou incerta · <strong>*</strong> = duas marcadas
          </p>
          {captura && captura.log.length > 0 && (
            <p className="dica">
              Quadro ao vivo até a captura ({captura.origem === 'camera-automatica' ? 'automática' : 'manual'}):{' '}
              {captura.log.length} leituras em {(captura.log.at(-1)!.ms / 1000).toFixed(1)} s ·{' '}
              {contagemDoLog(captura.log)}
            </p>
          )}
          {captura && captura.origem !== 'galeria' && (
            <>
              <button className="botao secundario" onClick={salvarRecorte}>
                💾 Salvar recorte para o conjunto de teste
              </button>
              <p className="dica">
                Arquivo: <code>{captura.arquivo.name}</code>. Anote as respostas <strong>reais</strong> da
                folha no <code>dataset/respostas.csv</code>, não as lidas pelo app.
              </p>
            </>
          )}
        </section>
      )}

      {ultima && captura && (
        <section className="cartao">
          <h2>Enviar esta captura</h2>
          <p className="dica">
            Vai para o repositório <strong>privado</strong> <code>{config.repo}</code>: a imagem que a leitura
            recebeu, a leitura, os tempos, o aparelho e o log do quadro ao vivo.
          </p>
          <label className="campo">
            Respostas reais da folha (opcional; _ = em branco, * = duas)
            <input
              value={respostasReais}
              placeholder={'ex.: ' + 'BABCDACC'.slice(0, captura.nQuestoes)}
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) =>
                setRespostasReais(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-E_*]/g, '')
                    .slice(0, captura.nQuestoes),
                )
              }
            />
          </label>
          {!respostasOk && (
            <p className="erro">
              {respostasReais.length} de {captura.nQuestoes} questões: complete ou apague.
            </p>
          )}
          <label className="campo">
            Observação (opcional)
            <input
              value={observacao}
              placeholder="ex.: não capturava sozinho; luz amarela"
              onChange={(e) => setObservacao(e.target.value)}
            />
          </label>
          <button
            className="botao"
            disabled={!config.token || !respostasOk || envio.estado === 'enviando'}
            onClick={() => void enviar()}
          >
            ☁️ {envio.estado === 'enviando' ? 'Enviando…' : 'Enviar ao repositório de capturas'}
          </button>
          {!config.token && <p className="dica">Configure o envio (abaixo) para enviar.</p>}
          {envio.estado === 'enviado' && (
            <p>
              ✅ Enviado:{' '}
              <a href={envio.url} target="_blank" rel="noreferrer">
                abrir no GitHub
              </a>
            </p>
          )}
          {envio.estado === 'erro' && <p className="erro">{envio.mensagem}</p>}
          <button className="botao secundario" disabled={!respostasOk} onClick={() => void salvarDados()}>
            💾 Salvar os dados (JSON) neste aparelho
          </button>
        </section>
      )}

      {medicoes.length > 0 && (
        <section className="cartao">
          <h2>Tempos</h2>
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                {medicoes.map((_, i) => (
                  <th key={i}>#{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>preparar foto (tela)</td>
                {medicoes.map((m, i) => (
                  <td key={i}>{ms(m.preparo)}</td>
                ))}
              </tr>
              {Object.keys(medicoes[0].tempos).map((etapa) => (
                <tr key={etapa}>
                  <td>{etapa}</td>
                  {medicoes.map((m, i) => (
                    <td key={i}>{ms(m.tempos[etapa])}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>espera (o resto do total)</td>
                {medicoes.map((m, i) => (
                  <td key={i}>{ms(espera(m))}</td>
                ))}
              </tr>
              <tr className="total">
                <td>total</td>
                {medicoes.map((m, i) => (
                  <td key={i}>{ms(m.idaEVolta)}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="dica">Meta: menos de 2000 ms por folha.</p>
          <h2>Para enviar ao grupo</h2>
          <textarea readOnly value={relatorio} rows={6} />
        </section>
      )}

      <section className="cartao" hidden={camera === 'visivel'}>
        <details open={envioAberto}>
          <summary>
            ☁️ Envio de capturas {config.token ? `(configurado, aparelho ${apelido})` : '(não configurado)'}
          </summary>
          <p className="dica">
            As capturas vão para um repositório <strong>privado</strong> do GitHub, porque podem ter prova real
            com nome de aluno; repositório público é recusado. Use um token <em>fine-grained</em> com acesso só a
            esse repositório e permissão <strong>Contents: Read and write</strong> (GitHub → Settings →
            Developer settings → Fine-grained tokens). O token fica só neste navegador.
          </p>
          <label className="campo">
            Repositório (dono/nome)
            <input
              value={config.repo}
              autoCapitalize="off"
              autoComplete="off"
              onChange={(e) => mudarConfig({ ...config, repo: e.target.value.trim() })}
            />
          </label>
          <label className="campo">
            Token
            <input
              type="password"
              value={config.token}
              autoComplete="off"
              onChange={(e) => mudarConfig({ ...config, token: e.target.value.trim() })}
            />
          </label>
          <label className="campo">
            Apelido deste aparelho (vai no nome da pasta)
            <input
              value={config.apelido}
              placeholder={`ex.: iphone-11-luiz (sem apelido: ${apelidoPadrao(navigator.userAgent)})`}
              autoCapitalize="off"
              autoComplete="off"
              onChange={(e) => mudarConfig({ ...config, apelido: e.target.value })}
            />
          </label>
          {config.apelido && limparApelido(config.apelido) !== config.apelido && (
            <p className="dica">
              Nas pastas fica: <code>{limparApelido(config.apelido) || apelidoPadrao(navigator.userAgent)}</code>
            </p>
          )}
          <button className="botao secundario" disabled={!config.token} onClick={() => void testarConexao()}>
            Testar a conexão
          </button>
          {conexao && <p className={conexao.ok ? 'dica' : 'erro'}>{conexao.texto}</p>}
        </details>
      </section>

      <canvas ref={canvas} />
    </main>
  )
}
