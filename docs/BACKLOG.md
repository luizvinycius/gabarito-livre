# Backlog

Atualizado em 30/10/2026. O contexto de cada item está na [documentação do projeto](DOCUMENTACAO-PROJETO.md); os números entre parênteses apontam para as seções dela.

## Onde paramos (30/10: leitor sem remover o vermelho)
- **A etapa "remover vermelho" saiu do leitor** (3.5), no Python e no app: o professor escreve em vermelho depois de passar o leitor. Recorte no PC: 43,7 → 38,6 ms. Questões certas: dataset 344 de 508, sintético 850 de 894, capturas 301 de 354, sem erro silencioso novo. **Testes Vitest:** 90 (os 14 que saíram testavam a faixa do vermelho).
- [ ] **Medir no A32 e no iPhone** o ganho no celular. A etapa mais cara agora é `reduzir`.

### Antes (29/10, noite: capturas analisadas e leitor mais rápido)
- **40 capturas no repositório de capturas** (iPhone 11, iPhone 14 Pro, Galaxy A32 e o celular do Rhuan), com as respostas reais conferidas na foto e gravadas no `dados.json` de cada uma. `npm run avaliar -- --capturas ../../gabarito-livre-capturas/capturas` mede o leitor nelas; o Node lê exatamente o que cada celular leu. **84,2% das questões certas, 1 erro silencioso** (Galaxy, GS-07 a lápis, Q5 com B e E lida B). Caneta azul ou preta bem pintada: 100%.
- **Decisão: caneta vermelha e lápis fraco ficam fora.** Quase todos os `?` vêm de marca a lápis ou cinza, e a caneta vermelha do aluno era apagada como correção do professor (desde 30/10, não é mais apagada, mas continua fora do escopo). Em prova real a caneta vermelha não é permitida e os professores cobram caneta para marcar o gabarito.
- **Tabela cortada vira "tabela não encontrada"** nas 2 capturas manuais com a coluna E fora do quadro (a 193424 ficou 58 quadros em "cortada" ao vivo). A mensagem poderia pedir para afastar o celular.
- **Leitor ~30% mais rápido, com a saída idêntica** (3.5): o vermelho num laço só, sem as imagens HSV, e o fundo do papel não refeito quando não há vermelho. A redução para 800 px virou a etapa `reduzir` nos tempos. Na câmera, o canvas do recorte é reaproveitado e lido direto. Página de teste fora do pacote principal (carrega só no `#teste`). Folhas gravadas no aparelho só quando mudam, com a grade em uma casa decimal. **Testes Vitest:** 104.
- [ ] **Medir no A32 e no iPhone** o tempo por leitura e o "preparar foto" com o código novo (página de teste).

### Antes (29/10, envio de capturas)
- **Página de teste envia a captura para um repositório privado (3.5):** `gabarito-livre-capturas` (privado: pode ter prova real). Vai a imagem que a leitura recebeu e um `dados.json` com a leitura, a grade, os tempos, o aparelho, a versão do app e o **log do quadro ao vivo** (cada leitura até a captura e o estado do quadro). A página de teste ganhou a captura automática do app (o mesmo leitor, um OpenCV só). O mesmo token *fine-grained* serve para vários celulares; o apelido de cada aparelho vai no nome da pasta (`HHMMSS-8q-iphone-11`). Repositório público é recusado. Testado: envio real pelo PC (imagem idêntica, apagada depois) e, no navegador, a chamada à API e a recusa do token inválido. **Testes Vitest:** 87.
- [ ] **Testar o envio no iPhone** com um token de verdade e mandar as capturas das folhas que deram trabalho, com as respostas reais.
- [x] **Folha amassada no quadro-guia** (que dava "A tabela está saindo do quadro"): lida desde o PR #4, testado no iPhone.

### Antes (29/10, noite)
- **Folha curvada (3.4, passos 6 e 9):** correção por coluna sobre a homografia, ajuste alternado, resgate de coluna inteira deslocada (inclusive quando falta a A nas cadeias), cadeia que não atravessa para a linha de baixo e pista do lado na direção local. A `r-07` passou de tudo `?` a 10 de 10 (uma em branco com aviso); a `r-02` e a `r-11` continuam pedindo outra foto (3.6).
- **Conjunto sintético com folha curvada:** 12 imagens novas (arco e borda enrolada, 101 no total); de 75,9% para **100%** de questões certas nelas. As 89 de antes continuam iguais (sementes mantidas).
- **Resultado:** dataset (57 fotos) 65,2% → **66,9%**; sintético 92,3% → **94,1%**; **0 erro silencioso** nos dois, com Python e app idênticos (leituras e valores intermediários). Univag Q8 passou de C a `?` (rabisco no B perto do limite de dúvida). Tempo do app igual (~245 ms por folha no PC). **Testes Vitest:** 75.
- [x] **Correção em vermelho do professor com a regra nova (fotos do coordenador, fora do repositório):** 2 provas com vistos em vermelho lidas certas; com os vistos colados por cima das bolinhas vazias, a mesma leitura do código antigo, sem erro silencioso.

### Antes (29/10, tarde)
- **48 fotos novas do grupo** (`dataset/fotos/`): `r-01` a `r-12` (recortes das folhas com 4 tabelas), `lo-01` a `lo-12` e dois lotes GS, `gs-b-*` (18h15) e `gs-c-*` (19h53), com nomes por lote porque os códigos se repetem e alguns estão ilegíveis. As 4 fotos de lado ou de cabeça para baixo foram giradas; as tortas ficaram como estavam; 3 fotos repetidas ficaram de fora. As respostas foram anotadas olhando cada tabela ampliada, sem ver a leitura do app, e conferidas nas questões em que o app leu uma letra.
- **3 correções na leitura (3.4), no Python e no app:** a caneta escura numa luz quente (marrom) e a caneta rosa não são mais apagadas como vermelho do professor (havia **1 erro silencioso**, `gs-b-05` Q6); a pista do lado ignora a mesa e o piso em volta da folha (fotos em pé e nítidas davam tudo `?`); tabela pequena com as bolinhas detectadas é aceita com anel borrado.
- **Resultado, dataset inteiro (57 fotos, 508 questões):** antes 57,1% certas e 1 erro silencioso; agora **65,2% certas e 0 erro silencioso**. Conjunto sintético: 87,7% → **93,4%**, 0 erro silencioso; a luz amarela, que não era lida, passou a ser. Python e app leram igual em todas as imagens, com os mesmos valores intermediários. **Testes Vitest:** 72. Tempo por folha no PC igual ao de antes (~460 ms nas fotos novas, que mais vezes precisam da imagem 2× maior).
- **O que ainda dá `?` (com aviso, nunca nota errada):** foto muito inclinada, escura ou de muito longe (7 fotos em que a tabela nem é encontrada), lápis fraco de longe, caneta vermelha do aluno e 2 folhas curvadas (`r-02`, `r-11`). Próximo candidato: para as inclinadas, a busca com escala 3×.

### Antes (28/10)
- **Primeiras fotos reais do grupo:** 8 folhas (`dataset/fotos/GS-01` a `GS-08`), mandadas pelo WhatsApp (1280 × 720): deitadas, giradas, inclinadas e de longe. Antes, 14 de 76 questões certas; agora 63, **0 erro silencioso**. A GS-07 (tabela com ~200 px na foto) ainda não é lida: o app pede outra foto.
- **Foto da galeria girada, inclinada ou de longe (3.4, fim da seção):** grade nas 4 orientações, com o lado da folha tirado das linhas da coluna Questão; grade projetiva (perspectiva) com forma local de cada bolinha; nova tentativa com a imagem 2× maior. Lado incerto: tudo `?` e aviso "tire a foto com a folha em pé". A câmera (recorte do quadro-guia) não procura orientação.
- **Regras novas da leitura (3.4, passos 4 a 13):** anel fraco (3,4) aceito quando as colunas confirmam que a grade não está deslocada; segunda marcação entre 0,4 e 0,6 do destaque vira `?` (a GS-02 Q6, com duas marcadas, era lida como B sem aviso).
- **Conjunto sintético:** 87,4% → 87,7% de questões certas, 0 erro silencioso; Python e app leram igual nas 98 imagens. **Testes Vitest:** 70.
- **Folha de galeria é mais lenta:** ~310 ms no PC (antes ~140 ms); a câmera ao vivo não mudou. Falta medir no A32.

### Antes (21/10, noite)
- **Turma inteira e folhas revistas (3):** botão "Turma" com a nota de cada folha, média, maior e menor; tocar numa folha abre a leitura sobre a foto (guardada no IndexedDB) e deixa corrigir **qualquer** questão, não só as em dúvida. Campo opcional "Aluno". Folhas e gabaritos sobrevivem a recarregar a página; mudar uma letra do gabarito recalcula as notas já dadas.
- **Gabaritos salvos com nome (4):** novo, duplicar (prova B a partir da A), renomear, excluir; o número de questões trava enquanto houver folhas corrigidas com aquele gabarito.
- **Captura automática (5):** o quadro lê a tabela ao vivo e captura sozinho quando duas leituras seguidas acham a tabela inteira, parada e com as mesmas letras; depois de "Próxima folha", espera a folha sair do quadro (ou as letras mudarem) para não pegar a mesma folha de novo. Quadro muda de cor e mostra "Procurando", "Saindo do quadro", "Segure firme", "Troque a folha". Dá para desligar. Testado no Chrome do PC com uma câmera falsa (vídeo com duas folhas); **falta testar no celular**.
- **Linhas a mais e tabela que escorrega (1):** regra das bolinhas detectadas por linha (3.4, passo 10). Avisa quando a tabela tem mais linhas que o gabarito (e a Q1 passa a ser a primeira linha da tabela) e quando o bloco escorrega para uma linha de "DISSERTATIVA" no modelo compacto, que antes dava nota errada sem aviso.
- **Conjunto sintético (2):** `poc/gerar_sinteticas.py`, 89 imagens (3.7). **0 erro silencioso** no Python e no app, com leituras idênticas nas duas implementações. Achou a limitação da luz muito amarela (3.6).
- **README para usuários (6):** como usar, instalar, dicas de foto e perguntas frequentes.
- **Testes Vitest:** 53 (leitura, correção, sessão, exportação e captura automática).
- **Depois dos 6 itens (commit a6c6143):** acerto por questão na turma (as que a maioria errou em vermelho); planilha CSV das notas (Excel em português) e "Copiar as notas"; tela sempre acesa com a câmera ligada (Wake Lock); botões duplicados escondidos nos avisos do resultado; workflow `leitura.yml` que mede o conjunto sintético no Python e no app a cada mudança no leitor e falha com erro silencioso ou leituras diferentes (`--leituras` nos dois avaliadores).

### Antes (21/10, tarde)
- **App do professor pronto para testar (MVP da semana 2):** gabarito (letra e valor de cada questão, soma, dividir um total) → câmera → resultado (nota, acertos, resposta lida, desenho da leitura sobre a foto) → próxima folha. As questões `?`/`*` e a tabela cortada pedem confirmação com um toque, e o gabarito fica salvo no aparelho. Testado no Chrome do PC com as 2 fotos de referência; **falta testar no iPhone e no A32.**
- **PWA:** instalável e offline (o OpenCV fica em cache). Testado no Chrome do PC.
- **App no ar no GitHub Pages:** https://luizvinycius.github.io/gabarito-livre/ (deploy a cada push na main, pelo `.github/workflows/pages.yml`). O `leitura.yml` mede o conjunto sintético a cada mudança no leitor (passou no 1º run, 21/10).
- **`npm run avaliar`:** mede o código do app no Node, com o mesmo CSV do `poc/avaliar.py`. A divergência da Q8 da foto 2 foi resolvida: era a redução da imagem, não a decodificação (3.6). Hoje os dois dão o mesmo preenchimento nas 80 bolinhas.
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
- [ ] **Montar o conjunto de 30 a 60 fotos** seguindo o `dataset/LEIAME.md`: fotos mandadas pelo WhatsApp com a lista de respostas (o coordenador importa com `poc/importar.py`) ou recortes salvos pelo app. *Grupo.* 57 até agora (29/10). Pedir fotos **de perto** (tabela grande na imagem) e mandadas **como Documento**: as 8 primeiras vieram comprimidas, e bolinha pequena é a maior causa de `?`.
  - [ ] **Testar no celular a foto da galeria** deitada/inclinada e o aviso de lado incerto; medir o tempo no A32.
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
- [ ] **Testar o MVP no iPhone e no A32** (câmera, captura automática, confirmação, próxima folha, turma, rever folha, gabaritos). *Coordenador.*
- [x] **Mostrar a turma inteira ao fim da sessão** e permitir corrigir uma folha já lida. (21/10)

## Semana 3: experiência e robustez
- [x] **Atrito ao encaixar a tabela:** captura automática quando a tabela fica parada dentro do quadro e retorno visual de "encaixou". (21/10; falta testar no celular e medir o consumo de bateria numa correção longa)
- [x] **Desenho da leitura sobre a foto** no resultado ("Ver a leitura sobre a foto"). (21/10)
- [x] **Último gabarito salvo** no localStorage. (21/10)
- [x] **Vários gabaritos salvos com nome** (provas A e B, turmas diferentes). (21/10)
- [x] **PWA:** instalável e offline, com o OpenCV em cache (testado no Chrome do PC, 21/10).
- [ ] **PWA no celular:** instalar no iPhone e no A32 e medir de novo o carregamento no A32; se continuar ruim, avaliar um build do OpenCV só com as funções usadas.
- [ ] **Aquecer a primeira captura da câmera:** "preparar foto" levou 1,6 s na primeira vez no A32.
- [x] **Remover vermelho mais rápido:** a mesma faixa do HSV num laço só, sem mudar a leitura (29/10). Usar só o canal R mudaria a leitura e não foi preciso.
- [x] **Tabela com uma linha a mais ou a menos** que o gabarito: avisa nos dois casos (3.4, passo 10). (21/10)
- [x] **Luz muito amarela:** resolvida no conjunto sintético e nas fotos do grupo pela regra do vermelho claro (29/10, 3.4 passo 2), conferida em 2 provas reais com correção em vermelho.

## Semana 4: piloto e entrega
- [x] **Deploy no GitHub Pages:** https://luizvinycius.github.io/gabarito-livre/ (21/10).
- [ ] **Testar o app publicado no celular:** conferir se o Safari passa a lembrar a permissão da câmera e se o PWA instala. Com o app no ar, o grupo pode usar o "Salvar recorte" (`#teste`) sem estar no Wi-Fi do coordenador.
- [ ] **Piloto** com o Professor B ou o Professor C numa turma real, medindo o tempo manual contra o tempo no app.
- [x] **README para usuários:** como usar, como instalar como app, dicas de foto e perguntas frequentes. (21/10)
- [ ] **Apresentação:** pitch, histórico das entrevistas e demonstração ao vivo.

## Pendências externas (seção 6)
- [ ] Modelo oficial do gabarito da Univag (pedido ao Professor B). Serve para recalibrar o quadro-guia.
- [ ] Os outros cursos (Administração etc.) usam a mesma tabela A–E?
- [ ] Nome do projeto, e confirmar que está livre.
- [x] **Repositório no GitHub:** https://github.com/luizvinycius/gabarito-livre (18/10).

## Depois do MVP (seção 1.4)
Identificação do aluno, planilha de notas para o AVA, provas A e B embaralhadas, análise das questões que mais confundiram, dissertativas, IA como segundo corretor, curadoria das regras do NDE e geração de questões presa ao material da aula.
