// O app do professor (Corretor) e, no endereço com #teste, a página de teste
// da leitura para o grupo (tempos, relatório, "Salvar recorte" e o envio das
// capturas para o repositório privado).

import { Suspense, lazy, useEffect, useState } from 'react'
import Corretor from './telas/Corretor'

// Só o grupo abre a página de teste: ela (e o envio ao GitHub) fica fora do
// pacote que o professor baixa. O service worker guarda o pedaço dela também,
// então ela abre sem internet.
const PaginaTeste = lazy(() => import('./telas/PaginaTeste'))

export default function App() {
  const [hash, setHash] = useState(location.hash)

  useEffect(() => {
    const mudar = () => setHash(location.hash)
    addEventListener('hashchange', mudar)
    return () => removeEventListener('hashchange', mudar)
  }, [])

  return hash === '#teste' ? (
    <Suspense fallback={<main>⏳ Abrindo a página de teste…</main>}>
      <PaginaTeste />
    </Suspense>
  ) : (
    <Corretor />
  )
}
