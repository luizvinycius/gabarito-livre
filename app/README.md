# App (React + Vite + TypeScript)

O app do professor (MVP, seção 2.1 da documentação): **gabarito → câmera → resultado → próxima folha**, com a nota, os acertos e a confirmação com um toque das questões em dúvida. O gabarito fica salvo no aparelho.

A **página de teste da leitura** (seção 8.5) continua no endereço com `#teste` (link no rodapé): carrega uma foto, mostra o tempo de cada etapa, o relatório para o grupo e o botão "Salvar recorte".

| Pasta | O que tem |
|---|---|
| `src/telas/` | `Corretor` (fluxo), `Gabarito`, `Resultado` e `PaginaTeste` |
| `src/correcao.ts` | nota, acertos e confirmações (testado no Vitest) |
| `src/omr/` | a leitura: `processar.ts` (OpenCV), `leitura.ts` (grade e decisão), `worker.ts`, `useLeitor.ts` |
| `scripts/avaliar.ts` | `npm run avaliar`: precisão do código do app no `dataset/` |

```bash
npm install
npm run dev        # serve em https://<ip-do-pc>:5173 na rede local
npm test           # testes do Vitest (src/omr/leitura.test.ts)
npm run avaliar    # precisão do código do app no dataset/ (como o poc/avaliar.py)
```

## Testar no celular
1. O celular precisa estar no **mesmo Wi-Fi** que o PC.
2. Abra o endereço `Network` que o `npm run dev` mostra, por exemplo `https://192.168.18.5:5173`.
3. O navegador vai avisar que o certificado não é confiável, porque é um certificado próprio, gerado pelo `@vitejs/plugin-basic-ssl`. Toque em **Avançado → Continuar** (Chrome) ou **Mostrar detalhes → visitar este site** (Safari).
4. Para medir os tempos, abra a página de teste (link no rodapé ou `#teste` no fim do endereço), espere o OpenCV carregar, escolha ou tire uma foto e toque em **Rodar de novo** umas 2 ou 3 vezes.
5. Copie o texto de "Para enviar ao grupo" e mande no grupo.

Se não abrir, o Firewall do Windows pode estar bloqueando o Node.js na rede privada.
