# Conjunto de teste

Fotos de folhas **preenchidas pelo próprio grupo**, impressas a partir do modelo (`folha-de-respostas-teste.pdf`, gerado por `poc/gerar_folha.py`; tem o campo "Código" para o `LV-01`). Nunca use provas reais de alunos: este repositório é público (seção 5 da documentação). A única exceção é `univag-compacto-01.jpg`, prova do próprio coordenador, publicada com autorização e com o nome riscado.

Há dois jeitos de contribuir. O mais simples é mandar as fotos para o coordenador; quem tiver o app aberto no celular pode salvar o recorte.

## Jeito 1: mandar as fotos para o coordenador (WhatsApp)
1. Imprima o modelo e escreva, **fora da tabela**, suas iniciais e um número: `LV-01`, `LV-02`… Não escreva o nome completo.
2. Preencha variando as condições: caneta azul, caneta preta e lápis; marcação forte, fraca, rabiscada e apagada; questão em branco e duas marcadas.
3. Fotografe a folha inteira com a câmera normal do celular, variando luz (boa, sombra, amarela) e distância/ângulo (perto, longe, torta).
   - **iPhone:** Ajustes → Câmera → Formatos → **Mais Compatível**. Em "Alta Eficiência" a foto sai em HEIC, que o OpenCV não abre.
4. Anote o que está **marcado no papel**, uma linha por folha (`_` = em branco, `*` = duas marcadas):
   ```
   LV-01: BABCDACC - caneta azul, luz boa
   LV-02: A_BCD*CC - lapis, sombra
   ```
5. Mande as fotos pelo WhatsApp **como Documento** (📎 → Documento), para não perder qualidade, junto com a lista e o modelo do celular.

O coordenador então:
1. Salva as fotos em `dataset/fotos/` com o código da folha como nome, em minúsculas: `lv-01.jpg`.
2. Cola a lista num arquivo de texto e roda:
   ```bash
   python poc/importar.py lista.txt --celular "Galaxy A32"
   ```
   O script confere cada linha e acrescenta no `respostas.csv`, com os nomes das condições padronizados. Use `--testar` para ver o resultado sem gravar.

## Jeito 2: salvar o recorte pelo app
1. No app, abra a câmera, encaixe a tabela e toque em **Capturar**.
2. Toque em **💾 Salvar recorte para o conjunto de teste**. No celular, escolha "Salvar imagem" ou salve em Arquivos. O nome do arquivo começa com `recorte-`; não renomeie.
3. Coloque o arquivo em `dataset/fotos/` e acrescente uma linha em `respostas.csv`:
   ```csv
   recorte-8q-20261018-215723.jpg,8,A_BCD*CC,iPhone 11,lapis; sombra; em branco; dupla
   ```

## O CSV
- `respostas`: o que está **marcado na folha**, não o que o app leu. `_` = em branco, `*` = duas marcadas. (`?` = o app tem de pedir confirmação; só o conjunto sintético usa.)
- `condicao`: itens separados por `;`. Use sempre os mesmos nomes (`caneta azul`, `caneta preta`, `caneta rosa`, `caneta vermelha`, `lapis`, `forte`, `fraca`, `rabiscada`, `borracha`, `em branco`, `dupla`, `luz boa`, `sombra`, `luz amarela`, `perto`, `longe`, `torta`), para o relatório agrupar direito.
- Folha com várias tabelas na mesma foto: cada tabela vira um arquivo, recortado com folga e sem endireitar (`r-01` a `r-12`). Foto de lado ou de cabeça para baixo é girada antes de entrar (ninguém corrige assim); foto torta fica como está.
- Arquivos que começam com `recorte-` são lidos como recorte (800 px); os outros, como folha inteira (1000 px).

## Medir
```bash
python poc/avaliar.py              # algoritmo do protótipo em Python
cd app && npm run avaliar          # algoritmo do app, no Node
```
Os dois devem dar o mesmo resultado.

## Conjunto sintético
Enquanto as fotos não chegam, `python poc/gerar_sinteticas.py` gera em `dataset/sinteticas/` (fora do Git) 89 imagens desenhadas a partir da folha de teste, com caneta, lápis, borracha, sombra, luz amarela, foto torta, recortes deslocados e cortados e tabelas com linhas a mais. Para medir: `python poc/avaliar.py --conjunto sinteticas` e `cd app && npm run avaliar -- --conjunto sinteticas`. Não substitui as fotos reais.
