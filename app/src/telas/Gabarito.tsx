// Tela do gabarito (seção 2.1, item 1): número de questões, letra correta e
// valor de cada uma, com a soma dos valores para o professor conferir. Os
// gabaritos ficam salvos com nome (provas A e B, turmas diferentes).

import { useState } from 'react'
import {
  LETRAS,
  distribuir,
  formatarNota,
  gabaritoCompleto,
  lerNumero,
  redimensionar,
  soma,
} from '../correcao'
import type { GabaritoSalvo } from '../sessao'

const MAX_QUESTOES = 30

type Props = {
  gabarito: GabaritoSalvo
  gabaritos: GabaritoSalvo[]
  onMudar: (g: GabaritoSalvo) => void
  onEscolher: (id: string) => void
  onCriar: () => void
  onDuplicar: () => void
  onExcluir: () => void
  podeExcluir: boolean
  // folhas já corrigidas com este gabarito (na sessão atual)
  folhasCorrigidas: number
  onComecar: () => void
  // o leitor (OpenCV) ainda está carregando
  carregando: boolean
  erroLeitor: string | null
}

// Campo de número que aceita vírgula e só avisa a tela quando o valor é
// válido; enquanto o professor digita ("0,"), guarda o texto.
function CampoNumero({
  valor,
  onMudar,
  rotulo,
}: {
  valor: number
  onMudar: (n: number) => void
  rotulo: string
}) {
  const [texto, setTexto] = useState<string | null>(null)
  const invalido = texto !== null && Number.isNaN(lerNumero(texto))
  return (
    <input
      className={`valor ${invalido ? 'invalido' : ''}`}
      aria-label={rotulo}
      inputMode="decimal"
      value={texto ?? formatarNota(valor)}
      onChange={(e) => {
        setTexto(e.target.value)
        const n = lerNumero(e.target.value)
        if (!Number.isNaN(n)) onMudar(n)
      }}
      onBlur={() => setTexto(null)}
    />
  )
}

export default function Gabarito({
  gabarito,
  gabaritos,
  onMudar,
  onEscolher,
  onCriar,
  onDuplicar,
  onExcluir,
  podeExcluir,
  folhasCorrigidas,
  onComecar,
  carregando,
  erroLeitor,
}: Props) {
  const n = gabarito.letras.length
  const [totalTexto, setTotalTexto] = useState('10')
  // exclusão em dois toques, sem a caixa de confirmação do navegador
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const total = lerNumero(totalTexto)
  const faltando = gabarito.letras.flatMap((l, i) => (l ? [] : [i + 1]))
  // com folhas corrigidas, mudar o número de questões deixaria as notas sem sentido
  const quantidadeTravada = folhasCorrigidas > 0

  function mudarQuantidade(qtd: number) {
    if (quantidadeTravada) return
    onMudar({ ...gabarito, ...redimensionar(gabarito, Math.max(1, Math.min(MAX_QUESTOES, qtd || 1))) })
  }

  function escolher(i: number, letra: string) {
    const letras = [...gabarito.letras]
    letras[i] = letras[i] === letra ? '' : letra
    onMudar({ ...gabarito, letras })
  }

  function mudarValor(i: number, v: number) {
    const valores = [...gabarito.valores]
    valores[i] = v
    onMudar({ ...gabarito, valores })
  }

  return (
    <>
      <section className="cartao">
        <h2>Gabarito</h2>
        <div className="provas">
          <select
            aria-label="Gabarito em uso"
            value={gabarito.id}
            onChange={(e) => {
              setConfirmarExclusao(false)
              onEscolher(e.target.value)
            }}
          >
            {gabaritos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
          <button className="chip" onClick={onCriar}>
            ＋ Novo
          </button>
        </div>
        <label className="campo nome">
          Nome
          <input
            className="valor"
            value={gabarito.nome}
            maxLength={40}
            onChange={(e) => onMudar({ ...gabarito, nome: e.target.value })}
            onBlur={() => !gabarito.nome.trim() && onMudar({ ...gabarito, nome: 'Prova' })}
          />
        </label>
        <div className="atalhos acoes-gabarito">
          <button className="chip" onClick={onDuplicar}>
            Duplicar
          </button>
          {gabaritos.length > 1 && (
            <button
              className={`chip ${confirmarExclusao ? 'perigo' : ''}`}
              disabled={!podeExcluir}
              onClick={() => {
                if (!confirmarExclusao) return setConfirmarExclusao(true)
                setConfirmarExclusao(false)
                onExcluir()
              }}
            >
              {confirmarExclusao ? 'Toque de novo para excluir' : 'Excluir'}
            </button>
          )}
        </div>
        {gabaritos.length > 1 && !podeExcluir && folhasCorrigidas > 0 && (
          <p className="dica">Para excluir este gabarito, encerre antes a sessão da turma.</p>
        )}

        <div className="campo">
          Número de questões
          <div className="atalhos">
            {[8, 10].map((q) => (
              <button
                key={q}
                className={`chip ${n === q ? 'ativo' : ''}`}
                disabled={quantidadeTravada}
                onClick={() => mudarQuantidade(q)}
              >
                {q}
              </button>
            ))}
            <input
              type="number"
              inputMode="numeric"
              aria-label="Número de questões"
              min={1}
              max={MAX_QUESTOES}
              value={n}
              disabled={quantidadeTravada}
              onChange={(e) => mudarQuantidade(Number(e.target.value))}
            />
          </div>
        </div>
        {quantidadeTravada && (
          <p className="dica">
            Já há {folhasCorrigidas === 1 ? '1 folha corrigida' : `${folhasCorrigidas} folhas corrigidas`}{' '}
            com este gabarito. Para mudar o número de questões, encerre a sessão da turma ou crie outro
            gabarito. Mudar as respostas ou os valores recalcula as notas já dadas.
          </p>
        )}
      </section>

      <section className="cartao">
        <div className="gabarito">
          <div className="linha-gabarito cab">
            <span>Nº</span>
            <span>Resposta correta</span>
            <span>Valor</span>
          </div>
          {gabarito.letras.map((letra, i) => (
            <div className="linha-gabarito" key={i}>
              <span className="numero">{i + 1}</span>
              <div className="letras" role="radiogroup" aria-label={`Resposta da questão ${i + 1}`}>
                {LETRAS.map((l) => (
                  <button
                    key={l}
                    role="radio"
                    aria-checked={letra === l}
                    className={`letra ${letra === l ? 'marcada' : ''}`}
                    onClick={() => escolher(i, l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <CampoNumero
                rotulo={`Valor da questão ${i + 1}`}
                valor={gabarito.valores[i]}
                onMudar={(v) => mudarValor(i, v)}
              />
            </div>
          ))}
        </div>

        <p className="soma">
          Soma dos valores: <strong>{formatarNota(soma(gabarito.valores))}</strong>
        </p>
        <div className="distribuir">
          <span>Dividir igualmente</span>
          <input
            className={`valor ${Number.isNaN(total) ? 'invalido' : ''}`}
            aria-label="Total a dividir"
            inputMode="decimal"
            value={totalTexto}
            onChange={(e) => setTotalTexto(e.target.value)}
          />
          <button
            className="chip"
            disabled={Number.isNaN(total)}
            onClick={() => onMudar(distribuir(gabarito, total))}
          >
            Dividir
          </button>
        </div>
      </section>

      <section className="cartao">
        {erroLeitor && <p className="erro">{erroLeitor}</p>}
        <button className="botao" disabled={!gabaritoCompleto(gabarito)} onClick={onComecar}>
          📷 {folhasCorrigidas > 0 ? 'Continuar a correção' : 'Começar a correção'}
        </button>
        {faltando.length > 0 ? (
          <p className="dica">
            Falta escolher a resposta {faltando.length === 1 ? 'da questão' : 'das questões'}{' '}
            {faltando.join(', ')}.
          </p>
        ) : (
          carregando && !erroLeitor && <p className="dica">⏳ Preparando o leitor…</p>
        )}
      </section>
    </>
  )
}
