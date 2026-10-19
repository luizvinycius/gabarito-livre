# Corretor de Gabarito Open Source: documentação do projeto

> **Para que serve este documento:** reunir o que foi decidido, testado e planejado até 16/10/2026, para começar o desenvolvimento num ambiente novo e limpo, inclusive numa sessão nova de IA, sem depender do histórico da conversa.
>
> **Nome provisório:** "Gabarito Livre". Antes de adotar, confirme que o nome está livre.

---

## 1. Histórico: como chegamos aqui

### 1.1 Tema original
A ideia inicial, sugerida pelo Professor A, era "uma solução para professores no processo de criar e corrigir provas". A solução não estava definida, então fizemos entrevistas de descoberta seguindo a linha do *The Mom Test*: perguntar sobre o que a pessoa já fez, e não sobre o que ela faria.

### 1.2 Entrevistas (todas com professores da Univag)

| Professor | Data | Perfil | Principais pontos |
|---|---|---|---|
| Professor A | 04/10 | Área técnica, atípico | Monta as provas em LaTeX. Pagava uma ferramenta de correção e acabou programando a dele. Quer um editor ou gerador de PDF de prova. Não quer IA gerando as questões. |
| Professor B | 06/10 | Área técnica, membro do NDE | Monta no modelo Word e salva em PDF. Tem banco de questões próprio. Quer gerar questões **só a partir do conteúdo dado em sala**. Corrige à mão; testou ferramentas e achou burocráticas. Pagaria no máximo cerca de R$ 70 a 100 por ano. |
| Professor C | 06/10 | Área técnica | Cerca de 1 h por prova com ajuda de IA, de 15 a 20 provas por semestre e ~150 provas por rodada. *"Criar eu acho até mais fácil. O problema é corrigir."* As dissertativas são o lento. Largou a correção por foto porque era cara. |
| Professora D (Administração) | 13/10 | Única fora da área técnica | Cerca de 2h30 por prova com livro e 30 min com IA. Usou o Gradepen e largou por três motivos: precisava recadastrar a prova, funcionava mal no iPhone e tinha custo. Cada curso tem um modelo de prova diferente. |

Os arquivos originais (transcrições, resumos, áudios e vídeos) ficam fora do repositório; veja a seção 10.

### 1.3 Padrões encontrados
- **Todos** têm banco de questões próprio e usam IA para criar questões ou querem usar.
- **Todos** corrigem à mão. **3 de 4** testaram uma ferramenta paga de correção de gabarito e desistiram por preço, burocracia ou compatibilidade.
- Formatar a prova **não é** a dor principal: Word com o modelo da Univag funciona.
- A IA para criar questões ajuda, mas **foge do conteúdo dado em sala**.
- O lento na correção são as **dissertativas**.

### 1.4 Conclusão e mudança de rumo
As dores de criar e corrigir provas eram **mornas**: *"Não é algo que me tira o sono"* (Professor B); *"não, só tempo"* (Professor C). O processo atual funciona bem o suficiente.

O sinal mais forte das entrevistas foi outro: **os professores procuraram automação, alguns chegaram a pagar, e desistiram porque as ferramentas eram caras, burocráticas ou incompatíveis.** Por isso o projeto mudou para:

> **Recriar como open source, gratuito e simples algo que já existe (correção de gabarito pela câmera), atacando exatamente os motivos de abandono.**

Ideias discutidas e deixadas para depois, em ordem de afinidade com o MVP:
- identificação do aluno (número, matrícula ou QR code);
- planilha de notas exportável para o AVA;
- versões embaralhadas da prova (A e B) contra cola;
- análise de quais questões mais confundiram os alunos;
- correção de dissertativas questão por questão, com a mesma captura em lote;
- IA como "segundo corretor" das dissertativas;
- pré-curadoria automática das regras do NDE, em que o cliente seria a instituição e não o professor;
- geração de questões presa ao material da aula.

---

## 2. Objetivo atual

### 2.1 MVP (o que entra)
1. **Cadastro do gabarito:** sem cadastrar o texto das questões.
   - Quantidade de questões: 8 ou 10 no padrão NDE, mas configurável.
   - Letra correta de cada questão (A a E).
   - **Valor de cada questão.** Por padrão, todas valem o mesmo, e o professor pode mudar o valor de qualquer uma (ex.: Q1 = 0,75; Q2 = 1,0).
   - A tela mostra a **soma dos valores** para o professor conferir o total da parte objetiva.
2. **Leitura pela câmera** da tabela de respostas do **modelo atual da Univag**, sem marcadores pretos e sem folha própria.
3. **Resultado imediato:**
   - **nota da parte objetiva**, que é a soma dos valores das questões acertadas;
   - número de acertos;
   - resposta lida em cada questão.
4. **Confirmação manual** quando a leitura ficar incerta (`?`) ou houver duas marcadas (`*`): o professor confirma com um toque.
5. **Correção em sequência:** lê uma folha, mostra o resultado e passa para a próxima.

### 2.2 Fora do MVP
- **Identificar o aluno.** Decisão de 16/10: alunos às vezes fazem a prova sem estar na lista da turma, o que complicaria o fluxo. Fica para uma versão futura.
- Planilha ou exportação de notas, login, nuvem, backend, dissertativas, banco de questões e integração com o AVA.

### 2.3 Critérios de sucesso (definir o "funciona" antes de codar)
| Critério | Meta |
|---|---|
| Precisão da leitura | **≥ 99%** das marcações corretas num conjunto de **30 ou mais fotos** variadas |
| Erro silencioso (resposta errada sem aviso) | O mais próximo possível de 0. Na dúvida, o app pergunta. |
| Velocidade | **< 2 s por folha** num celular intermediário |
| Compatibilidade | Funcionar no **Android (Chrome)** e no **iPhone (Safari)** |

Se a precisão não chegar perto da meta até o fim da semana 1, reavaliamos a abordagem. A alternativa é uma folha própria com marcadores.

---

## 3. Testes já feitos: prova de conceito da leitura

### 3.1 Onde está
- Script: `poc/poc_bolhas.py` (Python + OpenCV).
- Fotos de teste: `provas/`, com duas fotos reais de provas da Univag.
- Saída visual: `poc/bolhas_0.png` e `poc/bolhas_1.png`, com as bolinhas lidas destacadas.

Para rodar:
```bash
pip install opencv-python numpy
python poc/poc_bolhas.py 8 "provas/foto1.jpeg" "provas/foto2.jpeg"
#                        ^ número de questões
```

### 3.2 Resultado
| Foto | Condições | Lidas certas | Incertas (`?`) | Erradas |
|---|---|---|---|---|
| Prova 1 | Caneta azul, folha curvada, tabela colada no cabeçalho | 8 de 8 | 0 | 0 |
| Prova 2 | Lápis, foto torta, outra folha por cima, caneta vermelha do professor | 7 de 8 | 1 | 0 |

A incerta foi uma marcação a lápis muito fraca, com a letra ainda visível. O app sinalizou em vez de chutar, que é o comportamento desejado.

### 3.3 O que tentamos e não funcionou
- **Usar as linhas da tabela como referência.** As linhas internas do modelo da Univag são **tracejadas** e saem fragmentadas na foto. Na foto 1, a tabela ainda fica colada às caixas do cabeçalho. Abandonamos essa abordagem.
- **Exigir as 5 bolinhas detectadas em cada linha.** Algumas bolinhas encostam na linha tracejada e não são detectadas. Foi substituído pelo ajuste da grade, descrito abaixo.
- **Corte fixo de escuridão** (pixel < 120). Falha com lápis e com sombra. Foi substituído pela normalização da iluminação.

### 3.4 Algoritmo atual (referência para portar para JavaScript)
1. **Redimensionar** para 1000 px de largura (folha inteira) ou 800 px (recorte do quadro-guia), com `INTER_AREA`.
2. **Remover a tinta vermelha** (correção do professor) via HSV: vira branco.
3. **Limiar adaptativo** (`adaptiveThreshold`, bloco 31, C = 8), seguido de **contornos**.
4. **Filtrar círculos:**
   - área > 150;
   - circularidade (`4π·área/perímetro²`) > 0,6;
   - proporção da caixa entre 0,75 e 1,33;
   - raio entre 8 e 40 px.

   Depois, remover duplicados (anel interno e externo do mesmo círculo).
5. **Ficar com o tamanho dominante:** só os raios entre 0,75 e 1,3 vezes a mediana.
6. **Encadear vizinhos horizontais:** distância entre 2 e 12 raios, desnível menor que 0,9 raio. Cadeias com 3 ou mais bolinhas são candidatas a linha de questão.
7. **Colunas:** agrupar os x de todas as bolinhas e ficar com os 5 grupos vizinhos mais povoados (A a E).
8. **Linhas:** índice da linha = posição y da cadeia dividida pelo espaçamento médio entre linhas.
9. **Ajuste afim** (linha, coluna) → (x, y) por mínimos quadrados, descartando pontos fora do padrão. Isso **estima a posição de todas as bolinhas**, inclusive as não detectadas, e tolera rotação, escala e posição.
10. **Escolher as N linhas consecutivas** com mais evidência, onde N é o número de questões do gabarito. As candidatas incluem N linhas acima e abaixo das detectadas, porque a questão 1 ou a última podem não ter sido detectadas. A evidência de cada linha é o número de bolinhas detectadas nela mais a **pontuação de anel** (0 a 5): em cada posição prevista, o quanto há um círculo escuro (raio de 0,7 a 1,1) com papel claro em volta (1,4 raio), procurando numa vizinhança de até 0,3 raio porque a grade afim erra alguns pixels nas pontas quando há perspectiva.
    - **Tabela cortada:** se alguma linha escolhida pontuar menos que **4,3**, a grade pode estar deslocada; **todas** as respostas viram `?` e o app pede para reenquadrar. Nas fotos de teste, as linhas da tabela tiraram 5,0 e as de fora no máximo 3,6.
11. **Normalizar a iluminação:** cinza dividido pelo fundo, que é a `medianBlur` de 15 px numa cópia a 1/4 do tamanho (equivale à de 61 px na imagem inteira e é ~7x mais rápida). Feita antes do passo 10, que também a usa.
12. **Medir o preenchimento:** escuridão média num disco de 0,6 raio em cada bolinha.
13. **Decidir por linha:** `gap` = maior escuridão − mediana da linha.
    - `gap < 0,15`: **`?`** (em branco ou incerto);
    - segunda maior também alta (> 0,6 · gap acima da mediana): **`*`** (duas marcadas);
    - caso contrário, a letra mais escura.

### 3.5 Teste do OpenCV.js no navegador (18/10)
Página de teste em `app/` (seção 8.5): roda num Web Worker as etapas pesadas do algoritmo (remover vermelho, limiar adaptativo, contornos, filtro de círculos e normalização da iluminação), sem ainda decidir as respostas.

| Aparelho | Carregar o OpenCV (1 vez) | 1ª folha | Folhas seguintes |
|---|---|---|---|
| PC, Chrome | 0,8 a 1,7 s | ~300 ms | ~170 ms |
| iPhone, Safari 18.7 | 2,3 s | 479 ms | ~300 ms |

**Conclusão:** o OpenCV.js 5.0 (`@techstark/opencv-js`, num worker de módulo) funciona no Safari do iPhone, com folga para a meta de < 2 s. A stack está mantida.

Observações:
- O tempo no iPhone foi medido com uma foto qualquer, não com uma prova; o tempo quase não depende do conteúdo da imagem. Falta repetir com uma foto de prova para ver a detecção das bolinhas.
- O navegador acha um pouco mais de círculos que o Python na mesma foto (57 × 54), por causa do redimensionamento feito pelo canvas. Comparar com cuidado ao portar.
- Falta testar no Chrome do Android.

**Quadro-guia na câmera (18/10).** Numa foto de prova tirada no iPhone, a leitura da foto inteira deslocou a grade em uma linha: a questão 1 não virou candidata e o texto abaixo da tabela entrou como linha 8. Para resolver, a câmera ao vivo mostra um quadro onde o professor encaixa a tabela. A altura do quadro acompanha o número de questões, e só o recorte dele, com 10% de margem, vai para a leitura.
- Resultado no iPhone: **leitura correta**, com **117 a 161 ms por folha**, menos que com a foto inteira.
- As proporções do quadro (linha = 8,5% da largura da tabela, cabeçalho = 1 linha) foram estimadas pelas fotos. É preciso recalibrar com o modelo oficial.
- **Tolerância ao enquadramento (18/10).** Com a tabela um pouco acima ou abaixo do quadro, a questão 1 às vezes não era lida. Causas: a numeração das linhas começava na primeira linha detectada, então uma questão 1 não detectada nem entrava como candidata; e a altura aparente da tabela varia muito com o ângulo da câmera (a distância entre linhas foi de 0,59 a 0,90 da distância entre colunas nas duas fotos), então um quadro baixo cortava as últimas questões. Mudanças: pontuação de anel e regra da tabela cortada (passo 10), quadro mais alto (linha = 11% da largura) e recorte com 30% de folga vertical. Teste com recortes simulados, deslocando a tabela de −1,5 a +1,5 linha: **26/26 certos e nenhum erro silencioso** (antes: 14/26 e 13 respostas erradas sem aviso). Com quadros ou margens piores, a leitura falha, mas sempre com aviso.
- A câmera fica ligada entre uma folha e outra, porque religar faz o Safari pedir permissão de novo.
- **Android antigo (Galaxy A32, Chrome):** leitura correta, mas lento. O OpenCV levou 7,3 s para carregar, a 1ª folha 5,0 s (aquecimento) e as seguintes de 0,9 a 1,7 s. Otimizações feitas em seguida, medidas no PC: aquecimento automático depois de carregar; limites de cor do vermelho reaproveitados entre leituras; normalização da iluminação numa cópia a 1/4 do tamanho, com o mesmo resultado nas fotos de referência e diferença máxima de 0,006 no preenchimento. No PC, a leitura caiu de ~170 ms para ~100 ms, e a etapa de normalizar, de ~83 ms para ~11 ms. O `poc_bolhas.py` foi atualizado junto. **Medido de novo no A32: 105 a 126 ms por folha**, mais de 10x mais rápido, com a leitura correta. O ganho foi bem maior que no PC; a explicação provável é que as imagens grandes criadas e descartadas a cada leitura pesavam muito num celular com pouca memória.
- **Em observação:** encaixar a tabela no quadro exige um pouco de cuidado. Não é difícil, mas pode cansar numa correção longa (150 provas). Ideias para a semana 3: quadro mais tolerante, captura automática quando a tabela estiver estável dentro do quadro e retorno visual de "encaixou".

### 3.6 Limitações conhecidas
- Testado em **só 2 fotos** reais, do mesmo modelo, mais recortes simulados a partir delas. Os limites (0,15 do gap, 4,3 da pontuação de anel) precisam ser calibrados com o conjunto de fotos.
- Ainda não testado:
  - questão em branco;
  - duas marcadas de propósito;
  - borracha;
  - luz ruim;
  - foto muito inclinada ou em perspectiva forte;
  - tabela de 10 questões;
  - outros modelos de curso.
- Na foto 2 inteira, a questão 8 sai `C` no Python e `?` no app (gap de 0,13, perto do limite de 0,15): pequenas diferenças na decodificação da imagem mudam a grade em 1 ou 2 px. É um aviso, não um erro silencioso.
- Marcação muito fraca a lápis fica no limite (`?`).
- Se a tabela tiver uma linha a mais ou a menos que o gabarito, a regra da tabela cortada deve pegar parte dos casos, mas isso não foi testado.

---

## 4. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Interface | **React + Vite** | O coordenador já domina React. O Vite é leve e rápido. |
| Linguagem | **TypeScript** (confirmado em 18/10) | Menos bugs num grupo de 7 com níveis diferentes |
| App instalável | **PWA** (`vite-plugin-pwa`) | Funciona no Android e no iPhone sem loja e pode ser instalado na tela inicial |
| Visão computacional | **OpenCV.js** (pacote npm `@techstark/opencv-js` ou build oficial) | Mesma API do protótipo em Python, então o algoritmo da seção 3.4 passa quase direto |
| Processamento | **Web Worker** | O OpenCV.js é pesado (vários MB de WASM) e o processamento não pode travar a tela da câmera |
| Câmera | `navigator.mediaDevices.getUserMedia` | Padrão do navegador. **Exige HTTPS.** |
| Armazenamento local | `localStorage` ou IndexedDB | Guardar os gabaritos e a última sessão. Sem servidor. |
| Testes | **Vitest** e um script de avaliação sobre o conjunto de fotos | Medir a precisão a cada mudança no algoritmo |
| Protótipo e experimentos | **Python + OpenCV** (`poc/`) | Iterar o algoritmo é mais rápido em Python; depois porta para JS |
| Hospedagem | **GitHub Pages** (ou Vercel/Netlify) | Grátis e com HTTPS |
| Licença | **MIT** (confirmado em 18/10) | Simples e permissiva |

**Sem backend:** a foto é processada no próprio celular. Isso deixa a hospedagem de graça e evita guardar dados de alunos em servidor (LGPD).

### Pontos técnicos de atenção
- **Safari no iPhone:** câmera exige HTTPS e interação do usuário; o OpenCV.js precisa ser testado logo no começo, porque o iPhone foi um dos motivos de abandono das ferramentas atuais.
- **Tamanho do OpenCV.js:** carregar uma vez, deixar em cache via PWA e mostrar o progresso no primeiro carregamento.
- **Ler do vídeo ou de foto:** o mais simples é capturar um quadro do vídeo ao toque. A leitura contínua e automática pode vir depois.

---

## 5. Privacidade e regras do repositório
- **Nunca publicar fotos reais de provas com nome ou assinatura de aluno.** As fotos em `provas/` e as imagens `poc/bolhas_*.png` têm dados de um aluno real e **não podem ir para o repositório público**.
- O conjunto de teste deve usar folhas preenchidas **pelo próprio grupo**, impressas a partir do modelo.
- Adicionar ao `.gitignore`: `provas/`, `poc/*.png` e qualquer pasta com fotos reais.

---

## 6. Pendências e bloqueios

| Item | Situação | Responsável |
|---|---|---|
| Modelo oficial do gabarito da Univag (Word/PDF) | Pedido ao Professor B, aguardando | Coordenador |
| Os professores podem usar uma folha de gabarito própria? | Perguntado, aguardando. Só importa se a leitura do modelo atual falhar. | Coordenador |
| Os modelos dos outros cursos (Administração etc.) usam a mesma tabela A–E? | Não verificado | Grupo |
| Confirmar TypeScript e a licença | Decidido em 18/10: TypeScript e MIT | Coordenador |
| Nome do projeto | A decidir e verificar se está livre | Grupo |

---

## 7. Plano de 4 semanas

| Semana | Objetivo | Entregas |
|---|---|---|
| **1: provar que a leitura funciona** | Responder: "o algoritmo atinge a meta em fotos reais?" | Conjunto com 30 a 60 fotos e as respostas certas anotadas. Script de avaliação. Algoritmo ajustado em Python. **Teste do OpenCV.js no Safari do iPhone.** |
| **2: app básico** | Fluxo de ponta a ponta no celular | Projeto React + PWA. Tela do gabarito (letras e valor de cada questão). Câmera. Algoritmo portado para JS num Web Worker. Tela de resultado com confirmação de `?` e `*`. |
| **3: experiência e robustez** | Rápido e sem atrito | Correção em sequência, retorno visual das bolinhas lidas, aviso quando a grade estiver inconsistente, gabaritos salvos, modo offline. |
| **4: piloto e entrega** | Validação real | Piloto com o Professor B ou o Professor C numa turma de verdade. Medir o tempo manual contra o tempo no app. Corrigir bugs. README, deploy e apresentação. |

---

## 8. Passo a passo para começar no ambiente novo

### 8.1 Repositório
```bash
mkdir gabarito-livre && cd gabarito-livre
git init
# copiar deste diretório:
#   poc/poc_bolhas.py          -> poc/poc_bolhas.py   (NÃO copiar poc/*.png)
#   DOCUMENTACAO-PROJETO.md    -> docs/DOCUMENTACAO-PROJETO.md
```

`.gitignore` inicial:
```
node_modules/
dist/
provas/
dataset/fotos-reais/
poc/*.png
.env
```

### 8.2 Estrutura sugerida
```
gabarito-livre/
├── docs/
│   └── DOCUMENTACAO-PROJETO.md
├── poc/                      # protótipo Python (laboratório do algoritmo)
│   ├── poc_bolhas.py
│   └── avaliar.py            # a criar: roda o algoritmo no dataset e mede a precisão
├── dataset/
│   ├── fotos/                # fotos preenchidas pelo grupo (sem dados reais)
│   └── respostas.csv         # gabarito real de cada foto
└── app/                      # React + Vite + PWA
    └── src/
        ├── omr/              # algoritmo de leitura (porte do poc_bolhas.py)
        │   └── worker.ts     # roda o OpenCV.js fora da thread da tela
        ├── pages/            # Gabarito, Camera, Resultado
        └── storage/          # gabaritos salvos (localStorage/IndexedDB)
```

### 8.3 Formato do conjunto de teste (`dataset/respostas.csv`)
```csv
arquivo,n_questoes,respostas,celular,condicao
ana_01.jpg,8,BABCDACC,iPhone 12,caneta azul; luz boa
ana_02.jpg,8,A_BCD*CC,Moto G,lapis; sombra; Q2 em branco; Q6 dupla
```
- `_` = questão em branco, `*` = duas marcadas de propósito.
- **Anote as respostas reais da folha**, não as que o app leu.
- Arquivos que começam com `recorte-` foram salvos pelo app com o botão "Salvar recorte" (só a tabela) e são lidos a 800 px; os demais são a folha inteira (1000 px). O recomendado é usar recortes, porque é o que o app lê de verdade.
- `python poc/avaliar.py` compara o lido com o esperado e informa: % de acertos, % com aviso (`?`/`*`) e **erros silenciosos**, que é a métrica mais importante, separados por celular e por condição (cada item de `condicao` separado por `;`). Com `--depurar`, salva em `poc/saida/` a imagem das folhas com problema. Sai com código 1 se houver erro silencioso.

### 8.4 Criar o app
```bash
npm create vite@latest app -- --template react-ts
cd app
npm install
npm install -D vite-plugin-pwa
npm install @techstark/opencv-js   # ou carregar o opencv.js oficial como asset
npm run dev -- --host              # para testar no celular na mesma rede
```
A câmera no celular só funciona com **HTTPS**. Para testar no aparelho durante o desenvolvimento, use um túnel (por exemplo `ngrok` ou `cloudflared`) ou o plugin `@vitejs/plugin-basic-ssl`.

### 8.5 Primeira tarefa técnica (antes de qualquer tela)
Fazer um "hello world" de OpenCV.js **no Safari do iPhone e no Chrome do Android**: carregar uma foto, rodar `adaptiveThreshold` e `findContours` e medir o tempo. Se isso não funcionar bem, a stack precisa mudar, e é melhor descobrir no dia 1.

---

## 9. Divisão de tarefas sugerida (grupo de 7)

**Coordenador / programador principal:** algoritmo (Python, depois JS), arquitetura do app e revisão do código.

Tarefas para o restante do grupo:
1. **Conjunto de fotos (todos):** cada um imprime o modelo, preenche 5 a 10 folhas variando as condições abaixo, fotografa com o próprio celular e anota as respostas no CSV.
   - caneta azul, caneta preta e lápis;
   - marcação forte, fraca, rabiscada e apagada com borracha;
   - questão em branco e duas marcadas;
   - de perto, de longe, torta, com sombra e com luz amarela;
   - Android e iPhone.
2. **Pesquisa de concorrentes:** testar o ZipGrade, o Gradepen e o OMRChecker (GitHub) por 30 min cada. Anotar o passo a passo, onde atrapalham, o preço e se funcionam no iPhone.
3. **Telas no papel ou no Figma:** gabarito, câmera e resultado. Simples, com botões grandes, pensado para quem não é da área técnica.
4. **README e documentação** para usuários: como usar, como instalar como app e perguntas frequentes.
5. **Teste de compatibilidade:** listar os celulares do grupo e testar cada versão nova em todos.
6. **Apresentação:** pitch, histórico da descoberta (as entrevistas e a mudança de rumo são um ponto forte) e demonstração ao vivo.

---

## 10. Material de referência (fora do repositório)
As transcrições, os resumos e as gravações das entrevistas, o roteiro de entrevista (*Mom Test*), a primeira análise (Professor A, cujas hipóteses sobre formatação foram depois **refutadas**) e as fotos reais de provas ficam **só no computador do coordenador**, porque têm dados pessoais de professores e alunos. Não publicar.
