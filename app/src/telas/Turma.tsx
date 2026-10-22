// A turma inteira: todas as folhas corrigidas na sessão, com a nota de cada
// uma, a média, a maior e a menor nota, as questões que a turma mais errou e
// a planilha das notas. Tocar numa folha abre para rever ou corrigir.

import { useState } from 'react'
import { entregarArquivo } from '../arquivo'
import { formatarNota } from '../correcao'
import { type LinhaTurma, acertoPorQuestao, notasTexto, planilhaCsv, resumir } from '../sessao'

// Abaixo disto, a questão aparece destacada (a maioria errou).
const POUCO_ACERTO = 0.5

function nomeDaPlanilha() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `notas-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.csv`
}

type Props = {
  linhas: LinhaTurma[]
  onAbrir: (id: string) => void
  onContinuar: () => void
  onEncerrar: () => void
}

function hora(ms: number) {
  return ms ? new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''
}

export default function Turma({ linhas, onAbrir, onContinuar, onEncerrar }: Props) {
  // encerrar apaga as folhas: pede um segundo toque
  const [confirmar, setConfirmar] = useState(false)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const resumo = resumir(linhas)
  const gabaritos = [...new Map(linhas.map((l) => [l.gabarito.id, l.gabarito])).values()]
  const variosGabaritos = gabaritos.length > 1
  const de = (total: number) => `de ${formatarNota(total)}`

  async function baixarPlanilha() {
    const arquivo = new File([planilhaCsv(linhas)], nomeDaPlanilha(), { type: 'text/csv' })
    try {
      await entregarArquivo(arquivo)
      setMensagem(null)
    } catch (err) {
      setMensagem(`Não consegui salvar a planilha: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function copiarNotas() {
    try {
      await navigator.clipboard.writeText(notasTexto(linhas))
      setMensagem('Notas copiadas. Cole numa planilha ou numa mensagem.')
    } catch {
      setMensagem('Não consegui copiar. Use "Baixar planilha".')
    }
  }

  return (
    <>
      <section className="cartao">
        <h2>Turma</h2>
        {!resumo ? (
          <p>Nenhuma folha corrigida ainda.</p>
        ) : (
          <div className="resumo">
            <div>
              <strong>{resumo.folhas}</strong>
              <span>{resumo.folhas === 1 ? 'folha' : 'folhas'}</span>
            </div>
            <div>
              <strong>{formatarNota(resumo.media)}</strong>
              <span>média{resumo.total !== null && ` ${de(resumo.total)}`}</span>
            </div>
            <div>
              <strong>{formatarNota(resumo.maior)}</strong>
              <span>maior</span>
            </div>
            <div>
              <strong>{formatarNota(resumo.menor)}</strong>
              <span>menor</span>
            </div>
          </div>
        )}
      </section>

      {linhas.length > 0 && (
        <section className="cartao">
          <ol className="turma">
            {linhas.map((l) => (
              <li key={l.folha.id}>
                <button onClick={() => onAbrir(l.folha.id)}>
                  <span className="quem">
                    <strong>
                      Folha {l.numero}
                      {l.folha.identificacao.trim() && ` · ${l.folha.identificacao.trim()}`}
                    </strong>
                    <small>
                      {l.acertos}/{l.questoes} acertos
                      {variosGabaritos && ` · ${l.gabarito.nome}`}
                      {l.alteradas > 0 && ' · corrigida à mão'}
                      {l.folha.criada > 0 && ` · ${hora(l.folha.criada)}`}
                    </small>
                  </span>
                  <span className="nota-turma">
                    <strong>{formatarNota(l.nota)}</strong>
                    <small>{de(l.total)}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="dica">Toque numa folha para rever a leitura ou corrigir uma questão.</p>
        </section>
      )}

      {gabaritos
        // com uma folha só, a estatística não diz nada
        .filter((g) => linhas.filter((l) => l.gabarito.id === g.id).length > 1)
        .map((g) => (
          <section className="cartao" key={g.id}>
            <h2>Acerto por questão{variosGabaritos && ` · ${g.nome}`}</h2>
            <ol className="acerto-questoes">
              {acertoPorQuestao(linhas, g.id).map((q) => {
                const fracao = q.acertos / q.folhas
                return (
                  <li key={q.numero} className={fracao < POUCO_ACERTO ? 'pouco' : ''}>
                    <span className="numero">{q.numero}</span>
                    <span className="barra" aria-hidden="true">
                      <span style={{ width: `${fracao * 100}%` }} />
                    </span>
                    <span className="contagem">
                      {q.acertos}/{q.folhas} <small>({q.correta})</small>
                    </span>
                  </li>
                )
              })}
            </ol>
            <p className="dica">
              Quantas folhas acertaram cada questão (entre parênteses, a resposta certa). Em vermelho, as
              que a maioria errou: vale conferir o enunciado ou o gabarito.
            </p>
          </section>
        ))}

      {linhas.length > 0 && (
        <section className="cartao">
          <h2>Notas</h2>
          <button className="botao secundario" onClick={baixarPlanilha}>
            📄 Baixar planilha (CSV)
          </button>
          <button className="botao secundario" onClick={copiarNotas}>
            📋 Copiar as notas
          </button>
          {mensagem && <p className="dica">{mensagem}</p>}
          <p className="dica">
            A planilha tem a nota, os acertos e a letra que valeu em cada questão, e abre no Excel ou no
            Google Planilhas.
          </p>
        </section>
      )}

      <section className="cartao">
        <button className="botao" onClick={onContinuar}>
          📷 Continuar corrigindo
        </button>
        {linhas.length > 0 && (
          <button
            className={`botao ${confirmar ? 'perigo' : 'secundario'}`}
            onClick={() => {
              if (!confirmar) return setConfirmar(true)
              setConfirmar(false)
              onEncerrar()
            }}
          >
            {confirmar
              ? `Toque de novo para apagar as ${linhas.length} folhas`
              : 'Encerrar a sessão (apaga as folhas)'}
          </button>
        )}
        {confirmar && (
          <button className="botao secundario" onClick={() => setConfirmar(false)}>
            Cancelar
          </button>
        )}
      </section>
    </>
  )
}
