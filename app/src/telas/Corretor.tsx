// Fluxo do MVP (seção 2.1): gabarito → câmera → resultado → próxima folha,
// com a turma inteira ao fim (e a qualquer momento) e as folhas já
// corrigidas abertas de novo para rever ou corrigir. Gabaritos e folhas
// ficam no aparelho (sessao.ts), as fotos no IndexedDB (fotos.ts).

import { useCallback, useEffect, useMemo, useState } from 'react'
import Camera from '../Camera'
import { type Confirmacao, corrigir } from '../correcao'
import { apagarFotos, guardarFoto, lerFoto } from '../fotos'
import { type Foto, LARGURA_RECORTE, larguraDoArquivo } from '../omr/imagem'
import { type Leitura, useLeitor } from '../omr/useLeitor'
import {
  type Estado,
  type Folha,
  criarGabarito,
  duplicarGabarito,
  encerrarSessao,
  escolherGabarito,
  excluirFolha,
  excluirGabarito,
  folhasDoGabarito,
  gabaritoAtual,
  gravarNoAparelho,
  lerDoAparelho,
  linhasDaTurma,
  mudarGabarito,
  novoId,
  podeExcluir,
  salvarFolha,
} from '../sessao'
import Gabarito from './Gabarito'
import Resultado, { type LeituraTela } from './Resultado'
import Turma from './Turma'

type Etapa = 'gabarito' | 'camera' | 'resultado' | 'turma' | 'folha'

// Confirmações sem a questão q (null = volta ao que o app leu).
function confirmar(c: Record<number, Confirmacao>, q: number, letra: string | null) {
  const novas = { ...c }
  if (letra === null) delete novas[q]
  else novas[q] = letra
  return novas
}

// Uma folha guardada vira a leitura que a tela de resultado espera.
function leituraDaFolha(f: Folha): LeituraTela {
  return {
    circulos: [],
    grade: f.grade,
    respostas: f.lidas.map((letra) => ({ letra, preenchimento: [] })),
    tabelaCortada: false,
    ladoIncerto: false,
    linhasExtras: 0,
  }
}

export default function Corretor() {
  const leitor = useLeitor()
  const [estado, setEstado] = useState<Estado>(lerDoAparelho)
  const [semEspaco, setSemEspaco] = useState(false)
  const [etapa, setEtapa] = useState<Etapa>('gabarito')
  // A câmera fica ligada (só escondida) entre uma folha e outra: religar
  // a câmera faz o Safari pedir permissão de novo.
  const [cameraLigada, setCameraLigada] = useState(false)
  // a câmera abriu para a próxima folha: a captura automática espera a troca
  const [exigirTroca, setExigirTroca] = useState(false)

  // folha nova
  const [foto, setFoto] = useState<Foto | null>(null)
  // incrementa a cada foto, para descartar leituras antigas e reiniciar a
  // tela de resultado
  const [idFoto, setIdFoto] = useState(0)
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)
  const [confirmacoes, setConfirmacoes] = useState<Record<number, Confirmacao>>({})
  const [identificacao, setIdentificacao] = useState('')

  // folha já corrigida aberta de novo (cópia editável até salvar)
  const [editando, setEditando] = useState<Folha | null>(null)
  const [fotoEditando, setFotoEditando] = useState<Foto | null>(null)

  const gabarito = gabaritoAtual(estado)
  const nQuestoes = gabarito.letras.length
  const linhas = useMemo(() => linhasDaTurma(estado), [estado])

  useEffect(() => {
    setSemEspaco(!gravarNoAparelho(estado))
  }, [estado])

  // Lê a foto assim que ela chega e o leitor está pronto (a primeira foto
  // pode chegar antes do OpenCV terminar de carregar).
  useEffect(() => {
    // leitura já pronta: veio da captura automática
    if (!foto || !leitor.pronto || leitura) return
    let atual = true
    leitor
      .ler(foto, nQuestoes)
      .then((r) => atual && setLeitura(r))
      .catch((e: Error) => atual && setErroLeitura(e.message))
    return () => {
      atual = false
    }
    // nQuestoes fica de fora: mudar o gabarito não relê a folha
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foto, idFoto, leitor.pronto, leitor.ler])

  function usarFoto(nova: Foto, pronta: Leitura | null = null) {
    if (foto?.fonte instanceof ImageBitmap) foto.fonte.close()
    setFoto(nova)
    setIdFoto((n) => n + 1)
    setLeitura(pronta)
    setErroLeitura(null)
    setConfirmacoes({})
    setIdentificacao('')
    setEtapa('resultado')
  }

  async function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return
    try {
      usarFoto({ fonte: await createImageBitmap(arquivo), largura: larguraDoArquivo(arquivo.name) })
    } catch (err) {
      setErroLeitura(`Não consegui abrir a foto: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function abrirCamera(proximaFolha = false) {
    setExigirTroca(proximaFolha)
    setCameraLigada(true)
    setEtapa('camera')
  }

  // Lê o quadro ao vivo para a captura automática.
  const ler = leitor.ler
  const analisar = useCallback(
    (recorte: HTMLCanvasElement) => ler({ fonte: recorte, largura: LARGURA_RECORTE }, nQuestoes),
    [ler, nQuestoes],
  )

  const correcao = corrigir(gabarito, leitura?.respostas.map((r) => r.letra) ?? [], confirmacoes)

  // Guarda a folha nova na sessão (a foto vai para o IndexedDB em segundo plano).
  function guardarFolhaNova() {
    if (!foto) return
    const folha: Folha = {
      id: novoId(),
      gabaritoId: gabarito.id,
      criada: Date.now(),
      lidas: leitura?.respostas.map((r) => r.letra) ?? [],
      confirmacoes,
      identificacao: identificacao.trim(),
      grade: leitura?.grade ?? null,
      largura: foto.largura,
    }
    setEstado((e) => salvarFolha(e, folha))
    void guardarFoto(folha.id, foto.fonte, foto.largura)
  }

  async function abrirFolha(id: string) {
    const f = estado.folhas.find((x) => x.id === id)
    if (!f) return
    setEditando(f)
    setFotoEditando(null)
    setEtapa('folha')
    const imagem = await lerFoto(id)
    if (imagem) setFotoEditando({ fonte: imagem, largura: f.largura })
  }

  function fecharFolha() {
    if (fotoEditando?.fonte instanceof ImageBitmap) fotoEditando.fonte.close()
    setEditando(null)
    setFotoEditando(null)
    setEtapa('turma')
  }

  const gabaritoEditando = editando && estado.gabaritos.find((g) => g.id === editando.gabaritoId)

  return (
    <main>
      <header className="topo">
        <h1>Gabarito Livre</h1>
        <div className="atalhos">
          {etapa !== 'gabarito' && etapa !== 'folha' && (
            <button className="chip" onClick={() => setEtapa('gabarito')}>
              Gabarito
            </button>
          )}
          {(etapa === 'gabarito' || etapa === 'camera') && estado.folhas.length > 0 && (
            <button className="chip" onClick={() => setEtapa('turma')}>
              Turma ({estado.folhas.length})
            </button>
          )}
        </div>
      </header>

      {semEspaco && (
        <p className="erro cartao">
          Não consegui guardar os dados no aparelho (sem espaço ou em aba anônima). Se a página
          recarregar, as folhas corrigidas se perdem.
        </p>
      )}

      {etapa === 'gabarito' && (
        <Gabarito
          gabarito={gabarito}
          gabaritos={estado.gabaritos}
          onMudar={(g) => setEstado((e) => mudarGabarito(e, g))}
          onEscolher={(id) => setEstado((e) => escolherGabarito(e, id))}
          onCriar={() => setEstado(criarGabarito)}
          onDuplicar={() => setEstado(duplicarGabarito)}
          onExcluir={() => setEstado((e) => excluirGabarito(e, e.atual))}
          podeExcluir={podeExcluir(estado, gabarito.id)}
          folhasCorrigidas={folhasDoGabarito(estado, gabarito.id).length}
          onComecar={() => abrirCamera(estado.folhas.length > 0)}
          carregando={!leitor.pronto}
          erroLeitor={leitor.erro}
        />
      )}

      {cameraLigada && (
        <section className="cartao" hidden={etapa !== 'camera'}>
          <h2>
            Folha {estado.folhas.length + 1} · {gabarito.nome}
          </h2>
          <Camera
            nQuestoes={nQuestoes}
            visivel={etapa === 'camera'}
            exigirTroca={exigirTroca}
            analisar={leitor.pronto ? analisar : undefined}
            onFechar={() => {
              setCameraLigada(false)
              setEtapa(estado.folhas.length > 0 ? 'turma' : 'gabarito')
            }}
            onCapturar={(recorte, pronta) => usarFoto({ fonte: recorte, largura: LARGURA_RECORTE }, pronta)}
          />
          {erroLeitura && !foto && <p className="erro">{erroLeitura}</p>}
          <label className="botao secundario">
            🖼️ Escolher foto da galeria
            <input type="file" accept="image/*" onChange={(e) => escolherFoto(e.target.files?.[0])} />
          </label>
        </section>
      )}

      {etapa === 'resultado' && foto && (
        <Resultado
          key={idFoto}
          titulo={`Folha ${estado.folhas.length + 1} · ${gabarito.nome}`}
          foto={foto}
          leitura={leitura}
          erro={erroLeitura ?? (leitor.pronto ? null : leitor.erro)}
          correcao={correcao}
          identificacao={identificacao}
          onIdentificacao={setIdentificacao}
          onConfirmar={(q, letra) => setConfirmacoes((c) => confirmar(c, q, letra))}
          onRefazer={() => abrirCamera()}
          onAjustarGabarito={() => setEtapa('gabarito')}
          acoes={(pronta) => (
            <>
              <button
                className="botao"
                disabled={!pronta}
                onClick={() => {
                  guardarFolhaNova()
                  abrirCamera(true)
                }}
              >
                📷 Próxima folha
              </button>
              <button
                className="botao secundario"
                disabled={!pronta}
                onClick={() => {
                  guardarFolhaNova()
                  setEtapa('turma')
                }}
              >
                Salvar e ver a turma
              </button>
              <button className="botao secundario" onClick={() => abrirCamera()}>
                Tirar esta folha de novo
              </button>
            </>
          )}
        />
      )}

      {etapa === 'turma' && (
        <Turma
          linhas={linhas}
          onAbrir={abrirFolha}
          onContinuar={() => abrirCamera(true)}
          onEncerrar={() => {
            setEstado(encerrarSessao)
            void apagarFotos()
          }}
        />
      )}

      {etapa === 'folha' && editando && gabaritoEditando && (
        <Resultado
          key={editando.id}
          titulo={`Folha ${estado.folhas.findIndex((f) => f.id === editando.id) + 1} · ${gabaritoEditando.nome}`}
          foto={fotoEditando}
          leitura={leituraDaFolha(editando)}
          erro={null}
          correcao={corrigir(gabaritoEditando, editando.lidas, editando.confirmacoes)}
          identificacao={editando.identificacao}
          onIdentificacao={(t) => setEditando({ ...editando, identificacao: t })}
          onConfirmar={(q, letra) => setEditando({ ...editando, confirmacoes: confirmar(editando.confirmacoes, q, letra) })}
          acoes={(pronta) => (
            <>
              <button
                className="botao"
                disabled={!pronta}
                onClick={() => {
                  setEstado((e) => salvarFolha(e, { ...editando, identificacao: editando.identificacao.trim() }))
                  fecharFolha()
                }}
              >
                Salvar alterações
              </button>
              <button className="botao secundario" onClick={fecharFolha}>
                Voltar sem salvar
              </button>
              <BotaoExcluir
                onExcluir={() => {
                  setEstado((e) => excluirFolha(e, editando.id))
                  void apagarFotos([editando.id])
                  fecharFolha()
                }}
              />
            </>
          )}
        />
      )}

      <footer className="rodape">
        <a href="#teste">Página de teste (desenvolvedor)</a>
      </footer>
    </main>
  )
}

function BotaoExcluir({ onExcluir }: { onExcluir: () => void }) {
  const [confirmar, setConfirmar] = useState(false)
  return (
    <button
      className={`botao ${confirmar ? 'perigo' : 'secundario'}`}
      onClick={() => (confirmar ? onExcluir() : setConfirmar(true))}
    >
      {confirmar ? 'Toque de novo para excluir a folha' : 'Excluir esta folha'}
    </button>
  )
}
