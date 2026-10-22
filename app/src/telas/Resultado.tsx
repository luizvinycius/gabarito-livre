// Tela de resultado (seção 2.1, itens 3 a 5): nota da parte objetiva,
// acertos, resposta lida em cada questão e confirmação com um toque das
// questões em dúvida ('?' e '*'). Serve também para rever uma folha já
// corrigida: qualquer questão pode ser corrigida com um toque.

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { type Correcao, LETRAS, duvida, formatarNota } from '../correcao'
import { type Foto, desenharFoto, desenharLeitura } from '../omr/imagem'
import type { Leitura } from '../omr/useLeitor'

// O que a tela precisa da leitura (uma folha já corrigida guarda só isto).
export type LeituraTela = Pick<Leitura, 'circulos' | 'grade' | 'respostas' | 'tabelaCortada' | 'linhasExtras'>

type Props = {
  titulo: string
  // null enquanto a foto não chegou (ou se a folha foi guardada sem foto)
  foto: Foto | null
  // null enquanto o worker lê a folha
  leitura: LeituraTela | null
  erro: string | null
  correcao: Correcao
  identificacao: string
  onIdentificacao: (texto: string) => void
  // letra marcada pelo aluno, 'X' (nenhuma) ou null (volta ao que o app leu)
  onConfirmar: (questao: number, letra: string | null) => void
  onRefazer?: () => void
  onAjustarGabarito?: () => void
  // botões do fim da tela; pronta: a nota está fechada
  acoes: (pronta: boolean) => ReactNode
}

function descricaoLida(lida: string) {
  if (lida === '?') return 'em branco ou incerta'
  if (lida === '*') return 'duas marcadas'
  return lida
}

export default function Resultado({
  titulo,
  foto,
  leitura,
  erro,
  correcao,
  identificacao,
  onIdentificacao,
  onConfirmar,
  onRefazer,
  onAjustarGabarito,
  acoes,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  // Com a tabela cortada ou não encontrada, o professor pode preferir
  // conferir à mão a tirar outra foto.
  const [conferirAMao, setConferirAMao] = useState(false)
  // Com linhas a mais, o professor confirma que as questões são as primeiras.
  const [aceitarExtras, setAceitarExtras] = useState(false)
  // questão sem dúvida que o professor abriu para corrigir
  const [aberta, setAberta] = useState<number | null>(null)

  useEffect(() => {
    if (!foto) return
    desenharFoto(canvas.current, foto)
    if (leitura) desenharLeitura(canvas.current, leitura.circulos, leitura.grade, leitura.respostas)
  }, [foto, leitura])

  const { nota, total, acertos, pendentes, questoes } = correcao
  const naoEncontrada = !!leitura && leitura.respostas.length === 0 && !conferirAMao
  const cortada = !!leitura && leitura.tabelaCortada && !conferirAMao
  const extras = !!leitura && !cortada && !naoEncontrada && leitura.linhasExtras > 0 && !aceitarExtras
  const mostrarQuestoes = !!leitura && !naoEncontrada && !cortada && !extras
  const pronta = mostrarQuestoes && pendentes === 0

  return (
    <>
      <section className="cartao">
        <h2>{titulo}</h2>
        {erro && <p className="erro">Não consegui ler a folha: {erro}</p>}
        {!leitura && !erro && <p>⏳ Lendo a folha…</p>}

        {(naoEncontrada || cortada) && (
          <>
            <p className="erro">
              {naoEncontrada
                ? 'Não encontrei a tabela de respostas nesta foto. Tire outra, com a tabela inteira dentro do quadro.'
                : 'A tabela parece estar cortada ou fora do quadro. Afaste um pouco o celular e tire outra foto.'}
            </p>
            {onRefazer && (
              <button className="botao" onClick={onRefazer}>
                📷 Tirar outra foto
              </button>
            )}
            <button className="botao secundario" onClick={() => setConferirAMao(true)}>
              Conferir as respostas à mão
            </button>
          </>
        )}

        {extras && (
          <>
            <p className="erro">
              A tabela desta folha parece ter {questoes.length + leitura!.linhasExtras} questões, mas o
              gabarito tem {questoes.length}.
            </p>
            {onAjustarGabarito && (
              <button className="botao" onClick={onAjustarGabarito}>
                Ajustar o gabarito
              </button>
            )}
            {onRefazer && (
              <button className="botao secundario" onClick={onRefazer}>
                📷 Tirar outra foto
              </button>
            )}
            <button className="botao secundario" onClick={() => setAceitarExtras(true)}>
              Corrigir só as {questoes.length} primeiras
            </button>
          </>
        )}

        {mostrarQuestoes && (
          <div className={`nota ${pendentes ? 'parcial' : ''}`}>
            <strong>{formatarNota(nota)}</strong>
            <span>de {formatarNota(total)}</span>
            <p>
              {acertos} de {questoes.length} acertos
            </p>
            {pendentes > 0 && (
              <p className="aviso">
                Confirme {pendentes === 1 ? 'a questão marcada' : `as ${pendentes} questões marcadas`}{' '}
                em vermelho para fechar a nota.
              </p>
            )}
          </div>
        )}

        {mostrarQuestoes && (
          <label className="identificacao">
            Aluno <span className="dica">(opcional)</span>
            <input
              className="valor"
              placeholder="Nome ou número"
              value={identificacao}
              onChange={(e) => onIdentificacao(e.target.value)}
            />
          </label>
        )}
      </section>

      {mostrarQuestoes && (
        <section className="cartao">
          <ol className="questoes">
            {questoes.map((q, i) => {
              const emDuvida = duvida(q.lida)
              const aberto = emDuvida || aberta === i || q.alterada
              const classe = emDuvida ? (q.final === null ? 'pendente' : 'confirmada') : q.alterada ? 'alterada' : ''
              return (
                <li key={i} className={classe}>
                  <span className="numero">{q.numero}</span>
                  <button
                    className="lida"
                    aria-expanded={aberto}
                    onClick={() => !emDuvida && setAberta(aberta === i ? null : i)}
                  >
                    {emDuvida ? (
                      <>
                        Lida: <em>{descricaoLida(q.lida)}</em>
                      </>
                    ) : q.alterada ? (
                      <>
                        Lida: {q.lida}, corrigida para <strong>{q.final === 'X' ? 'nenhuma' : q.final}</strong>
                      </>
                    ) : (
                      <>
                        Lida: <strong>{q.lida}</strong>
                      </>
                    )}
                    <small>Correta: {q.correta}</small>
                  </button>
                  <span className={`marca ${q.final === null ? '' : q.certa ? 'certa' : 'errada'}`}>
                    {q.final === null ? '?' : q.certa ? '✓' : '✗'}
                  </span>
                  {aberto && (
                    <div
                      className="confirmar"
                      role="radiogroup"
                      aria-label={`O que o aluno marcou na questão ${q.numero}`}
                    >
                      {[...LETRAS, 'X'].map((l) => (
                        <button
                          key={l}
                          role="radio"
                          aria-checked={q.final === l}
                          className={`letra ${q.final === l ? 'marcada' : ''}`}
                          onClick={() => {
                            // tocar de novo na letra lida desfaz a correção
                            onConfirmar(i, !emDuvida && l === q.lida ? null : l)
                            if (!emDuvida) setAberta(null)
                          }}
                        >
                          {l === 'X' ? 'Nenhuma' : l}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <p className="dica">
            Nas questões em dúvida, toque na letra que o aluno marcou. "Nenhuma" vale para questão em
            branco, com duas marcadas ou ilegível, e não conta ponto. Se o app leu alguma letra errada,
            toque na questão para corrigir.
          </p>
        </section>
      )}

      {/* com um aviso na tela, as saídas ficam no próprio aviso */}
      {!naoEncontrada && !cortada && !extras && <section className="cartao">{acoes(pronta)}</section>}

      {foto && (
        <details className="cartao">
          <summary>Ver a leitura sobre a foto</summary>
          <p className="dica">
            Verde: bolinha lida. Laranja: as outras posições da tabela. Vermelho: questão em dúvida.
          </p>
          <canvas ref={canvas} />
        </details>
      )}
    </>
  )
}
