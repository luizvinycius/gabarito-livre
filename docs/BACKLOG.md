# Backlog

Atualizado em 21/10/2026. O contexto de cada item está na [documentação do projeto](DOCUMENTACAO-PROJETO.md); os números entre parênteses apontam para as seções dela.

## Onde paramos (21/10)
- **App do professor pronto para testar (MVP da semana 2):** gabarito (letra e valor de cada questão, soma, dividir um total) → câmera → resultado (nota, acertos, resposta lida, desenho da leitura sobre a foto) → próxima folha. As questões `?`/`*` e a tabela cortada pedem confirmação com um toque, e o gabarito fica salvo no aparelho. Testado no Chrome do PC com as 2 fotos de referência; **falta testar no iPhone e no A32.**
- **PWA:** instalável e offline (o OpenCV fica em cache). Testado no Chrome do PC.
- **Deploy no GitHub Pages preparado** (`.github/workflows/pages.yml`), mas ainda **não ativado**.
- **`npm run avaliar`:** mede o código do app no Node, com o mesmo CSV do `poc/avaliar.py`. A divergência da Q8 da foto 2 foi resolvida: era a redução da imagem, não a decodificação (3.6). Hoje os dois dão o mesmo preenchimento nas 80 bolinhas.
- **Testes Vitest:** 24 testes em `leitura.ts` e `correcao.ts`.
- **Fotos do grupo:** mensagem enviada no WhatsApp; `dataset/LEIAME.md` e `poc/importar.py` cobrem as fotos que chegarem.
- **Folha de teste para imprimir:** `dataset/folha-de-respostas-teste.pdf` (gerada por `poc/gerar_folha.py`), 12 tabelas: 6 de 8 e 6 de 10 questões. Páginas 1 e 2 no modelo das fotos de referência, em 4 tamanhos; página 3 no **modelo compacto** (grade grossa, bolinha grande, "01 (0,75)", linhas de dissertativa), com proporções diferentes em cada tabela.
- **Correção de luz com mediana de 93 px** (era 61): no modelo compacto, a bolinha pintada cheia entre linhas grossas virava "papel" e saía mais clara que as vazias. Com 93 px: 12/12 tabelas sintéticas, as 2 fotos de referência e a foto real do modelo compacto (`dataset/fotos/univag-compacto-01.jpg`, nome riscado) certas, no Python e no app. Falta confirmar com fotos com sombra.

### Antes (18/10)
- **Stack validada:** OpenCV.js num Web Worker funciona no Safari do iPhone 11 e no Chrome de um Galaxy A32 (3.5).
- **Leitura de ponta a ponta no navegador:** o algoritmo completo do `poc_bolhas.py` foi portado para `app/src/omr/`. Foto de prova real tirada pela câmera do app lida corretamente no iPhone e no A32.
- **Velocidade:** ~0,1 s por folha no iPhone e no A32, bem abaixo da meta de 2 s. O OpenCV leva 2,3 s (iPhone) a 7,3 s (A32) para carregar, uma vez por sessão.
- **Câmera com quadro-guia,** que fica ligada entre as folhas (o Safari não pede permissão de novo).
- **Leitura tolerante ao enquadramento:** pontuação de anel e regra da tabela cortada. Nos recortes simulados, 26/26 certos e nenhum erro silencioso (3.4, passo 10).
- **`poc/avaliar.py`** pronto, mas ainda **sem fotos** no `dataset/` (`dataset/LEIAME.md`).

## Agora: fechar a semana 1 (a precisão é o critério que falta)
- [ ] **Testar no iPhone** a tolerância ao enquadramento (tabela um pouco acima/abaixo do quadro) e o botão "Salvar recorte" (agora na página de teste, link no rodapé ou `#teste`). *Coordenador.*
- [ ] **Montar o conjunto de 30 a 60 fotos** seguindo o `dataset/LEIAME.md`: fotos mandadas pelo WhatsApp com a lista de respostas (o coordenador importa com `poc/importar.py`) ou recortes salvos pelo app. *Grupo.*
  - Cobrir: caneta azul/preta, lápis, marcação fraca, rabiscada, borracha, questão em branco, duas marcadas, sombra, luz amarela, foto torta, **tabela de 10 questões**, Android e iPhone.
- [ ] **Rodar `python poc/avaliar.py` e `npm run avaliar`** e calibrar os limites com dados reais: gap de 0,15 (`?`), 0,6·gap (`*`), pontuação de anel de 4,3 (tabela cortada) e proporção do quadro (`ALTURA_LINHA` em `app/src/Camera.tsx`).
- [ ] **Decidir:** se a precisão não chegar perto de 99%, reavaliar a abordagem (folha própria com marcadores, seção 2.3).
- [x] **Avaliar o código do app, e não só o do Python:** `npm run avaliar` (21/10).

## Semana 2: app básico (MVP, seção 2.1)
- [x] **Tela do gabarito:** número de questões, letra correta de cada uma, valor de cada questão (todas iguais por padrão), soma dos valores e "dividir igualmente". (21/10)
- [x] **Tela de resultado:** nota da parte objetiva, número de acertos, resposta lida em cada questão. (21/10)
- [x] **Confirmação com um toque** das questões `?` e `*` ("Nenhuma" = não vale ponto), e do aviso de tabela cortada (tirar outra foto ou conferir à mão). A próxima folha só libera depois de confirmar. (21/10)
- [x] **Fluxo em sequência:** gabarito → câmera → resultado → próxima folha, com a lista das notas da sessão. (21/10)
- [x] **Página de teste:** virou o modo de desenvolvedor, em `#teste` (link no rodapé). (21/10)
- [x] **Testes Vitest** para `leitura.ts` e `correcao.ts`. (21/10)
- [ ] **Testar o MVP no iPhone e no A32** (câmera, confirmação, próxima folha, gabarito salvo). *Coordenador.*
- [ ] **Mostrar a turma inteira ao fim da sessão** e permitir corrigir uma folha já lida (hoje a lista só mostra as notas).

## Semana 3: experiência e robustez
- [ ] **Atrito ao encaixar a tabela** (em observação, relatado em 18/10): captura automática quando a tabela ficar estável dentro do quadro e retorno visual de "encaixou".
- [x] **Desenho da leitura sobre a foto** no resultado ("Ver a leitura sobre a foto"). (21/10)
- [x] **Último gabarito salvo** no localStorage. (21/10)
- [ ] **Vários gabaritos salvos com nome** (provas A e B, turmas diferentes).
- [x] **PWA:** instalável e offline, com o OpenCV em cache (testado no Chrome do PC, 21/10).
- [ ] **PWA no celular:** instalar no iPhone e no A32 e medir de novo o carregamento no A32; se continuar ruim, avaliar um build do OpenCV só com as funções usadas.
- [ ] **Aquecer a primeira captura da câmera:** "preparar foto" levou 1,6 s na primeira vez no A32.
- [ ] **Remover vermelho:** testar usar só o canal R da imagem, que é mais simples e mais rápido. Validar com o `avaliar.py`.
- [ ] **Tabela com uma linha a mais ou a menos** que o gabarito. Nos testes sintéticos (21/10), com **menos** linhas a regra da tabela cortada avisa; com **mais** linhas (folha de 10, gabarito de 8), o app lê 8 linhas seguidas **sem avisar**. Pensar num aviso (ex.: anel alto na linha logo depois da última).

## Semana 4: piloto e entrega
- [ ] **Deploy no GitHub Pages** (HTTPS de verdade): o workflow está pronto; falta ativar em Settings → Pages → Source: "GitHub Actions" e fazer o push. Conferir se o Safari passa a lembrar a permissão da câmera. Com o app no ar, o grupo pode usar o "Salvar recorte" (`#teste`) sem estar no Wi-Fi do coordenador.
- [ ] **Piloto** com o Professor B ou o Professor C numa turma real, medindo o tempo manual contra o tempo no app.
- [ ] **README para usuários:** como usar, como instalar como app, perguntas frequentes.
- [ ] **Apresentação:** pitch, histórico das entrevistas e demonstração ao vivo.

## Pendências externas (seção 6)
- [ ] Modelo oficial do gabarito da Univag (pedido ao Professor B). Serve para recalibrar o quadro-guia.
- [ ] Os outros cursos (Administração etc.) usam a mesma tabela A–E?
- [ ] Nome do projeto, e confirmar que está livre.
- [x] **Repositório no GitHub:** https://github.com/luizvinycius/gabarito-livre (18/10).

## Depois do MVP (seção 1.4)
Identificação do aluno, planilha de notas para o AVA, provas A e B embaralhadas, análise das questões que mais confundiram, dissertativas, IA como segundo corretor, curadoria das regras do NDE e geração de questões presa ao material da aula.
