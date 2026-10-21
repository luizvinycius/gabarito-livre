// Fluxo do MVP (seção 2.1): gabarito → câmera → resultado → próxima folha.

import { useEffect, useState } from 'react'
import Camera from '../Camera'
import { type Gabarito as TGabarito, corrigir, formatarNota, gabaritoVazio } from '../correcao'
import { type Foto, LARGURA_RECORTE, larguraDoArquivo } from '../omr/imagem'
import { type Leitura, useLeitor } from '../omr/useLeitor'
import Gabarito from './Gabarito'
import Resultado from './Resultado'

const CHAVE_GABARITO = 'gabarito-livre:gabarito'

// O último gabarito fica no aparelho, para o professor não digitar de novo
// se a página recarregar no meio da correção.
function gabaritoSalvo(): TGabarito {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE_GABARITO) ?? 'null')
    if (Array.isArray(g?.letras) && Array.isArray(g?.valores) && g.letras.length === g.valores.length && g.letras.length > 0)
      return g
  } catch {
    // sem localStorage (aba anônima) ou valor corrompido: começa do zero
  }
  return gabaritoVazio(8)
}

type Etapa = 'gabarito' | 'camera' | 'resultado'
type Folha = { nota: number; total: number; acertos: number; questoes: number }

export default function Corretor() {
  const leitor = useLeitor()
  const [gabarito, setGabarito] = useState(gabaritoSalvo)
  const [etapa, setEtapa] = useState<Etapa>('gabarito')
  // A câmera fica ligada (só escondida) entre uma folha e outra: religar
  // a câmera faz o Safari pedir permissão de novo.
  const [cameraLigada, setCameraLigada] = useState(false)
  const [foto, setFoto] = useState<Foto | null>(null)
  // incrementa a cada foto, para descartar leituras antigas e reiniciar a
  // tela de resultado
  const [idFoto, setIdFoto] = useState(0)
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [erroLeitura, setErroLeitura] = useState<string | null>(null)
  const [confirmacoes, setConfirmacoes] = useState<Record<number, string>>({})
  const [folhas, setFolhas] = useState<Folha[]>([])
  const nQuestoes = gabarito.letras.length

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_GABARITO, JSON.stringify(gabarito))
    } catch {
      // sem espaço ou sem permissão: o gabarito só não fica salvo
    }
  }, [gabarito])

  // Lê a foto assim que ela chega e o leitor está pronto (a primeira foto
  // pode chegar antes do OpenCV terminar de carregar).
  useEffect(() => {
    if (!foto || !leitor.pronto) return
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

  function usarFoto(nova: Foto) {
    if (foto?.fonte instanceof ImageBitmap) foto.fonte.close()
    setFoto(nova)
    setIdFoto((n) => n + 1)
    setLeitura(null)
    setErroLeitura(null)
    setConfirmacoes({})
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

  function abrirCamera() {
    setCameraLigada(true)
    setEtapa('camera')
  }

  const correcao = corrigir(gabarito, leitura?.respostas.map((r) => r.letra) ?? [], confirmacoes)

  function proxima() {
    const { nota, total, acertos, questoes } = correcao
    setFolhas((f) => [...f, { nota, total, acertos, questoes: questoes.length }])
    abrirCamera()
  }

  return (
    <main>
      <header className="topo">
        <h1>Gabarito Livre</h1>
        {etapa !== 'gabarito' && (
          <button className="chip" onClick={() => setEtapa('gabarito')}>
            ← Gabarito
          </button>
        )}
      </header>

      {etapa === 'gabarito' && (
        <Gabarito
          gabarito={gabarito}
          onMudar={setGabarito}
          onComecar={abrirCamera}
          carregando={!leitor.pronto}
          erroLeitor={leitor.erro}
        />
      )}

      {cameraLigada && (
        <section className="cartao" hidden={etapa !== 'camera'}>
          <h2>Folha {folhas.length + 1}</h2>
          <Camera
            nQuestoes={nQuestoes}
            visivel={etapa === 'camera'}
            onFechar={() => {
              setCameraLigada(false)
              setEtapa('gabarito')
            }}
            onCapturar={(recorte) => usarFoto({ fonte: recorte, largura: LARGURA_RECORTE })}
          />
          <label className="botao secundario">
            🖼️ Escolher foto da galeria
            <input type="file" accept="image/*" onChange={(e) => escolherFoto(e.target.files?.[0])} />
          </label>
        </section>
      )}

      {etapa === 'resultado' && foto && (
        <Resultado
          key={idFoto}
          numeroFolha={folhas.length + 1}
          foto={foto}
          leitura={leitura}
          erro={erroLeitura ?? (leitor.pronto ? null : leitor.erro)}
          correcao={correcao}
          onConfirmar={(q, letra) => setConfirmacoes((c) => ({ ...c, [q]: letra }))}
          onProxima={proxima}
          onRefazer={abrirCamera}
        />
      )}

      {folhas.length > 0 && etapa !== 'resultado' && (
        <section className="cartao">
          <h2>Corrigidas nesta sessão</h2>
          <ol className="historico">
            {folhas.map((f, i) => (
              <li key={i}>
                Folha {i + 1}: <strong>{formatarNota(f.nota)}</strong> de {formatarNota(f.total)} (
                {f.acertos}/{f.questoes})
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="rodape">
        <a href="#teste">Página de teste (desenvolvedor)</a>
      </footer>
    </main>
  )
}
