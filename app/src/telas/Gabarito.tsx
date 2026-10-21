// Tela do gabarito (seção 2.1, item 1): número de questões, letra correta e
// valor de cada uma, com a soma dos valores para o professor conferir.

import { useState } from 'react'
import {
  type Gabarito as TGabarito,
  LETRAS,
  distribuir,
  formatarNota,
  gabaritoCompleto,
  lerNumero,
  redimensionar,
  soma,
} from '../correcao'

const MAX_QUESTOES = 30

type Props = {
  gabarito: TGabarito
  onMudar: (g: TGabarito) => void
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

export default function Gabarito({ gabarito, onMudar, onComecar, carregando, erroLeitor }: Props) {
  const n = gabarito.letras.length
  const [totalTexto, setTotalTexto] = useState('10')
  const total = lerNumero(totalTexto)
  const faltando = gabarito.letras.flatMap((l, i) => (l ? [] : [i + 1]))

  function mudarQuantidade(qtd: number) {
    onMudar(redimensionar(gabarito, Math.max(1, Math.min(MAX_QUESTOES, qtd || 1))))
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
        <div className="campo">
          Número de questões
          <div className="atalhos">
            {[8, 10].map((q) => (
              <button
                key={q}
                className={`chip ${n === q ? 'ativo' : ''}`}
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
              onChange={(e) => mudarQuantidade(Number(e.target.value))}
            />
          </div>
        </div>
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
          📷 Começar a correção
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
