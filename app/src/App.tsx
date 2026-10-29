// O app do professor (Corretor) e, no endereço com #teste, a página de teste
// da leitura para o grupo (tempos, relatório, "Salvar recorte" e o envio das
// capturas para o repositório privado).

import { useEffect, useState } from 'react'
import Corretor from './telas/Corretor'
import PaginaTeste from './telas/PaginaTeste'

export default function App() {
  const [hash, setHash] = useState(location.hash)

  useEffect(() => {
    const mudar = () => setHash(location.hash)
    addEventListener('hashchange', mudar)
    return () => removeEventListener('hashchange', mudar)
  }, [])

  return hash === '#teste' ? <PaginaTeste /> : <Corretor />
}
