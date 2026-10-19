# Backlog

Atualizado em 18/10/2026. O contexto de cada item está na [documentação do projeto](DOCUMENTACAO-PROJETO.md); os números entre parênteses apontam para as seções dela.

## Onde paramos (18/10)
- **Stack validada:** OpenCV.js num Web Worker funciona no Safari do iPhone 11 e no Chrome de um Galaxy A32 (3.5).
- **Leitura de ponta a ponta no navegador:** o algoritmo completo do `poc_bolhas.py` foi portado para `app/src/omr/`. Foto de prova real tirada pela câmera do app lida corretamente no iPhone e no A32.
- **Velocidade:** ~0,1 s por folha no iPhone e no A32, bem abaixo da meta de 2 s. O OpenCV leva 2,3 s (iPhone) a 7,3 s (A32) para carregar, uma vez por sessão.
- **Câmera com quadro-guia,** que fica ligada entre as folhas (o Safari não pede permissão de novo).
- **Leitura tolerante ao enquadramento:** pontuação de anel e regra da tabela cortada. Nos recortes simulados, 26/26 certos e nenhum erro silencioso (3.4, passo 10).
- **`poc/avaliar.py`** pronto, mas ainda **sem fotos** no `dataset/` (`dataset/LEIAME.md`).
- **Página atual:** é uma página de **teste**, com tempos, relatório e botão de salvar recorte. As telas do MVP ainda não existem.

## Agora: fechar a semana 1 (a precisão é o critério que falta)
- [ ] **Testar no iPhone** a tolerância ao enquadramento (tabela um pouco acima/abaixo do quadro) e o botão "Salvar recorte". *Coordenador.*
- [ ] **Montar o conjunto de 30 a 60 fotos** com o botão "Salvar recorte", seguindo o `dataset/LEIAME.md`. *Grupo.*
  - Cobrir: caneta azul/preta, lápis, marcação fraca, rabiscada, borracha, questão em branco, duas marcadas, sombra, luz amarela, foto torta, **tabela de 10 questões**, Android e iPhone.
- [ ] **Rodar `python poc/avaliar.py`** e calibrar os limites com dados reais: gap de 0,15 (`?`), 0,6·gap (`*`), pontuação de anel de 4,3 (tabela cortada) e proporção do quadro (`ALTURA_LINHA` em `app/src/Camera.tsx`).
- [ ] **Decidir:** se a precisão não chegar perto de 99%, reavaliar a abordagem (folha própria com marcadores, seção 2.3).
- [ ] **Avaliar o código do app, e não só o do Python:** hoje são duas implementações que precisam ficar iguais, e já divergem num caso no limite (questão 8 da foto 2, seção 3.6). Opção: um `npm run avaliar` que roda o `app/src/omr/` no Node com o mesmo CSV.

## Semana 2: app básico (MVP, seção 2.1)
- [ ] **Tela do gabarito:** número de questões, letra correta de cada uma, valor de cada questão (todas iguais por padrão), soma dos valores.
- [ ] **Tela de resultado:** nota da parte objetiva, número de acertos, resposta lida em cada questão.
- [ ] **Confirmação com um toque** das questões `?` e `*`, e do aviso de tabela cortada.
- [ ] **Fluxo em sequência:** gabarito → câmera → resultado → próxima folha.
- [ ] **Página de teste:** mover tempos, relatório e "Salvar recorte" para um modo de desenvolvedor.
- [ ] **Testes Vitest** para `app/src/omr/leitura.ts` (`agruparLinhas`, `decidir`).

## Semana 3: experiência e robustez
- [ ] **Atrito ao encaixar a tabela** (em observação, relatado em 18/10): captura automática quando a tabela ficar estável dentro do quadro e retorno visual de "encaixou".
- [ ] **Desenho da leitura sobre a foto** no resultado, para o professor conferir as bolinhas lidas (já existe na página de teste).
- [ ] **Gabaritos salvos** (localStorage/IndexedDB).
- [ ] **PWA:** instalável e offline, com o OpenCV em cache. Medir de novo o carregamento no A32; se continuar ruim, avaliar um build do OpenCV só com as funções usadas.
- [ ] **Aquecer a primeira captura da câmera:** "preparar foto" levou 1,6 s na primeira vez no A32.
- [ ] **Remover vermelho:** testar usar só o canal R da imagem, que é mais simples e mais rápido. Validar com o `avaliar.py`.
- [ ] **Tabela com uma linha a mais ou a menos** que o gabarito: verificar se a regra da tabela cortada pega esse caso (3.6).

## Semana 4: piloto e entrega
- [ ] **Deploy no GitHub Pages** (HTTPS de verdade). Conferir se o Safari passa a lembrar a permissão da câmera.
- [ ] **Piloto** com o Professor B ou o Professor C numa turma real, medindo o tempo manual contra o tempo no app.
- [ ] **README para usuários:** como usar, como instalar como app, perguntas frequentes.
- [ ] **Apresentação:** pitch, histórico das entrevistas e demonstração ao vivo.

## Pendências externas (seção 6)
- [ ] Modelo oficial do gabarito da Univag (pedido ao Professor B). Serve para recalibrar o quadro-guia.
- [ ] Os outros cursos (Administração etc.) usam a mesma tabela A–E?
- [ ] Nome do projeto, e confirmar que está livre.
- [ ] **Repositório no GitHub:** criar e enviar o código (hoje só existe localmente).

## Depois do MVP (seção 1.4)
Identificação do aluno, planilha de notas para o AVA, provas A e B embaralhadas, análise das questões que mais confundiram, dissertativas, IA como segundo corretor, curadoria das regras do NDE e geração de questões presa ao material da aula.
