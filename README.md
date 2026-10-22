# Gabarito Livre

Corrige a parte objetiva da prova pela câmera do celular, **de graça e sem internet**. O professor cadastra as respostas certas uma vez, aponta o celular para a tabela de respostas de cada aluno e vê na hora a nota e os acertos. Quando a leitura fica em dúvida, o app pergunta em vez de chutar.

**Abrir o app:** https://luizvinycius.github.io/gabarito-livre/

> **Situação:** em teste (Projeto Integrador 2026, Univag). A leitura funciona no iPhone e no Android, em cerca de 0,1 s por folha, e está sendo medida com fotos reais. Veja o [backlog](docs/BACKLOG.md).

## Como usar
1. **Cadastre o gabarito.** Dê um nome (por exemplo, "Prova A, 3º semestre"), escolha o número de questões e toque na letra certa de cada uma. Todas as questões valem 1 ponto por padrão; mude o valor de cada uma ou use "Dividir igualmente" para repartir a nota total. O gabarito fica salvo no celular.
2. **Toque em "Começar a correção"** e aponte a câmera para a tabela de respostas da prova. Encaixe a tabela dentro do quadro, com o cabeçalho ("Questão · Respostas") na faixa de cima. O quadro fica verde quando a tabela encaixa.
3. **Segure firme.** Com a captura automática ligada, a foto é tirada sozinha quando a tabela encaixa. Também dá para tocar em "📸 Capturar" ou escolher uma foto da galeria.
4. **Confira o resultado:** a nota, os acertos e o que o app leu em cada questão. As questões em dúvida (em branco, duas marcadas ou marcação fraca) aparecem em vermelho: toque na letra que o aluno marcou, ou em "Nenhuma". Se o app leu alguma letra errada, toque na questão para corrigir. Se quiser, escreva o nome ou o número do aluno.
5. **Toque em "Próxima folha"** e siga para a próxima prova. A câmera espera você trocar a folha antes de tirar a próxima foto.
6. **Veja a turma** a qualquer momento (botão "Turma" no alto): a nota de cada folha, a média, a maior e a menor nota. Toque numa folha para rever a leitura sobre a foto ou corrigir uma questão. Ao terminar, "Encerrar a sessão" apaga as folhas do celular (os gabaritos continuam salvos).

Se você corrigir uma letra do gabarito no meio da correção, as notas das folhas já corrigidas são recalculadas.

## Instalar como app
Não precisa de loja de aplicativos. Depois de instalado, o app abre sem internet.
- **iPhone (Safari):** abra o endereço, toque em **Compartilhar** (o quadrado com a seta) e depois em **Adicionar à Tela de Início**.
- **Android (Chrome):** abra o endereço, toque no menu **⋮** e depois em **Instalar app** (ou **Adicionar à tela inicial**).

Na primeira vez, o app baixa o leitor (cerca de 13 MB) e leva alguns segundos para ficar pronto. Nas próximas, abre direto.

## Dicas para a foto
- Luz boa e sem sombra da mão ou do celular sobre a tabela.
- A tabela inteira dentro do quadro, sem cortar a primeira nem a última questão.
- Celular paralelo à folha, sem inclinar muito.
- Se aparecer "A tabela está saindo do quadro", afaste um pouco o celular.
- Luz muito amarela (lâmpada quente, à noite) ainda atrapalha a leitura: prefira luz branca ou do dia.

## Que folha de respostas funciona
O app lê a tabela de respostas que o professor já usa: uma coluna "Questão" e as alternativas **A a E** em bolinhas, uma linha por questão, como no modelo da Univag (inclusive com linhas de questão dissertativa embaixo). Não precisa de folha especial nem de marcadores.

Para testar, há uma [folha de respostas para imprimir](dataset/folha-de-respostas-teste.pdf) com tabelas de 8 e de 10 questões.

## Perguntas frequentes
**É de graça?** Sim, e o código é aberto (licença MIT).

**A foto vai para a internet?** Não. A foto é lida no próprio celular, e as notas e as fotos ficam guardadas só nele.

**Funciona sem internet?** Sim, depois da primeira vez que o app é aberto (ou instalado).

**E se eu fechar o app no meio da correção?** As folhas corrigidas e os gabaritos ficam salvos no celular. Ao abrir de novo, é só tocar em "Turma" ou continuar a correção. Numa aba anônima, nada fica salvo.

**Por que o app às vezes pergunta a resposta?** Quando a marcação está fraca, há duas bolinhas marcadas ou nenhuma, o app não arrisca: pede para você confirmar com um toque. Errar a nota sem avisar é o pior que pode acontecer, então o app prefere perguntar.

**E se o app ler uma letra errada?** Toque na questão e escolha a letra certa. A folha fica marcada como "corrigida à mão" na lista da turma.

**A tabela tem mais questões que o gabarito. E agora?** O app avisa. Você pode ajustar o gabarito, tirar outra foto ou corrigir só as primeiras questões.

**Tenho provas A e B.** Cadastre um gabarito para cada uma (ou use "Duplicar" e mude só as letras) e troque o gabarito antes de corrigir as folhas de cada tipo. A lista da turma mostra qual gabarito foi usado em cada folha.

**E as questões dissertativas?** O app corrige só a parte objetiva. A nota das dissertativas continua com o professor.

**Quantas questões dá para corrigir?** De 1 a 30 por gabarito, com 5 alternativas (A a E).

**Como apago tudo?** "Encerrar a sessão" apaga as folhas corrigidas e as fotos. Os gabaritos se excluem na tela do gabarito (sempre fica pelo menos um). Para apagar tudo de uma vez, limpe os dados do site nas configurações do navegador.

## Privacidade
Nunca publique fotos de provas reais com nome ou assinatura de alunos. O conjunto de teste deste repositório usa folhas preenchidas pelo próprio grupo.

## Para desenvolvedores
| Pasta | Conteúdo |
|---|---|
| [`app/`](app/) | App web (React + Vite + TypeScript). A leitura fica em `app/src/omr/` e roda num Web Worker com OpenCV.js |
| [`poc/`](poc/) | Protótipo do algoritmo em Python (`poc_bolhas.py`), avaliação da precisão (`avaliar.py`), folha de teste (`gerar_folha.py`) e conjunto sintético (`gerar_sinteticas.py`) |
| [`dataset/`](dataset/) | Conjunto de teste: fotos preenchidas pelo grupo e as respostas certas ([como contribuir](dataset/LEIAME.md)) |
| [`docs/`](docs/) | [Documentação do projeto](docs/DOCUMENTACAO-PROJETO.md) e [backlog](docs/BACKLOG.md) |

```bash
cd app
npm install
npm run dev      # https://<ip-do-pc>:5173; o celular precisa estar na mesma rede
npm test         # testes do Vitest
```
Para testar no celular, veja [`app/README.md`](app/README.md). Cada push na `main` publica o app no GitHub Pages.

O algoritmo existe em Python e em TypeScript, e os dois têm de dar a mesma leitura:
```bash
pip install opencv-python numpy pymupdf
python poc/avaliar.py                          # precisão nas fotos do dataset/
python poc/gerar_sinteticas.py                 # gera o conjunto sintético (dataset/sinteticas/)
python poc/avaliar.py --conjunto sinteticas    # e mede nele
cd app && npm run avaliar -- --conjunto sinteticas   # o mesmo, com o código do app
```

## Licença
[MIT](LICENSE)
