// A turma inteira: todas as folhas corrigidas na sessão, com a nota de cada
// uma, a média, a maior e a menor nota. Tocar numa folha abre para rever ou
// corrigir.

import { useState } from 'react'
import { formatarNota } from '../correcao'
import { type LinhaTurma, resumir } from '../sessao'

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
  const resumo = resumir(linhas)
  const variosGabaritos = new Set(linhas.map((l) => l.gabarito.id)).size > 1
  const de = (total: number) => `de ${formatarNota(total)}`

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
