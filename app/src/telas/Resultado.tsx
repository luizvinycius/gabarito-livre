// Tela de resultado (seção 2.1, itens 3 a 5): nota da parte objetiva,
// acertos, resposta lida em cada questão e confirmação com um toque das
// questões em dúvida ('?' e '*').

import { useEffect, useRef, useState } from 'react'
import { type Correcao, LETRAS, duvida, formatarNota } from '../correcao'
import { type Foto, desenharFoto, desenharLeitura } from '../omr/imagem'
import type { Leitura } from '../omr/useLeitor'

type Props = {
  numeroFolha: number
  foto: Foto
  // null enquanto o worker lê a folha
  leitura: Leitura | null
  erro: string | null
  correcao: Correcao
  onConfirmar: (questao: number, letra: string) => void
  onProxima: () => void
  onRefazer: () => void
}

function descricaoLida(lida: string) {
  if (lida === '?') return 'em branco ou incerta'
  if (lida === '*') return 'duas marcadas'
  return lida
}

export default function Resultado({
  numeroFolha,
  foto,
  leitura,
  erro,
  correcao,
  onConfirmar,
  onProxima,
  onRefazer,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  // Com a tabela cortada, o professor pode preferir conferir à mão a tirar
  // outra foto.
  const [conferirCortada, setConferirCortada] = useState(false)

  useEffect(() => {
    desenharFoto(canvas.current, foto)
    if (leitura) desenharLeitura(canvas.current, leitura.circulos, leitura.grade, leitura.respostas)
  }, [foto, leitura])

  const naoEncontrada = !!leitura && leitura.respostas.length === 0
  const cortada = !!leitura && leitura.tabelaCortada && !conferirCortada
  const mostrarQuestoes = !!leitura && !naoEncontrada && !cortada
  const { nota, total, acertos, pendentes, questoes } = correcao

  return (
    <>
      <section className="cartao">
        <h2>Folha {numeroFolha}</h2>
        {erro && <p className="erro">Não consegui ler a folha: {erro}</p>}
        {!leitura && !erro && <p>⏳ Lendo a folha…</p>}

        {naoEncontrada && (
          <p className="erro">
            Não encontrei a tabela de respostas nesta foto. Tire outra, com a tabela inteira dentro
            do quadro.
          </p>
        )}

        {cortada && (
          <>
            <p className="erro">
              A tabela parece estar cortada ou fora do quadro. Afaste um pouco o celular e tire
              outra foto.
            </p>
            <button className="botao" onClick={onRefazer}>
              📷 Tirar outra foto
            </button>
            <button className="botao secundario" onClick={() => setConferirCortada(true)}>
              Conferir as respostas à mão
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
      </section>

      {mostrarQuestoes && (
        <section className="cartao">
          <ol className="questoes">
            {questoes.map((q, i) => (
              <li key={i} className={duvida(q.lida) ? (q.final === null ? 'pendente' : 'confirmada') : ''}>
                <span className="numero">{q.numero}</span>
                <span className="lida">
                  {duvida(q.lida) ? (
                    <>
                      Lida: <em>{descricaoLida(q.lida)}</em>
                    </>
                  ) : (
                    <>
                      Lida: <strong>{q.lida}</strong>
                    </>
                  )}
                  <small>Correta: {q.correta}</small>
                </span>
                <span className={`marca ${q.final === null ? '' : q.certa ? 'certa' : 'errada'}`}>
                  {q.final === null ? '?' : q.certa ? '✓' : '✗'}
                </span>
                {duvida(q.lida) && (
                  <div className="confirmar" role="radiogroup" aria-label={`O que o aluno marcou na questão ${q.numero}`}>
                    {[...LETRAS, 'X'].map((l) => (
                      <button
                        key={l}
                        role="radio"
                        aria-checked={q.final === l}
                        className={`letra ${q.final === l ? 'marcada' : ''}`}
                        onClick={() => onConfirmar(i, l)}
                      >
                        {l === 'X' ? 'Nenhuma' : l}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="dica">
            Nas questões em dúvida, toque na letra que o aluno marcou. "Nenhuma" vale para questão em
            branco, com duas marcadas ou ilegível, e não conta ponto.
          </p>
        </section>
      )}

      <section className="cartao">
        <button className="botao" disabled={!mostrarQuestoes || pendentes > 0} onClick={onProxima}>
          📷 Próxima folha
        </button>
        <button className="botao secundario" onClick={onRefazer}>
          Tirar esta folha de novo
        </button>
      </section>

      <details className="cartao">
        <summary>Ver a leitura sobre a foto</summary>
        <p className="dica">
          Verde: bolinha lida. Laranja: as outras posições da tabela. Vermelho: questão em dúvida.
        </p>
        <canvas ref={canvas} />
      </details>
    </>
  )
}
