# Conjunto de teste

Fotos de folhas **preenchidas pelo próprio grupo**, impressas a partir do modelo. Nunca use provas reais de alunos: este repositório é público (seção 5 da documentação).

## Como contribuir
1. Imprima o modelo e preencha a tabela de respostas, variando as condições da seção 9 da documentação: caneta azul, caneta preta e lápis; marcação forte, fraca, rabiscada e apagada; questão em branco e duas marcadas; luz boa, sombra e luz amarela.
2. No app, abra a câmera, encaixe a tabela e toque em **Capturar**.
3. Toque em **💾 Salvar recorte para o conjunto de teste**. No celular, escolha "Salvar imagem" ou salve em Arquivos. O nome do arquivo começa com `recorte-`; não renomeie.
4. Coloque o arquivo em `dataset/fotos/` e acrescente uma linha em `respostas.csv`:
   ```csv
   recorte-8q-20261018-215723.jpg,8,A_BCD*CC,iPhone 11,lapis; sombra; Q2 em branco; Q6 dupla
   ```
   - `respostas`: o que está **marcado na folha**, não o que o app leu. `_` = em branco, `*` = duas marcadas.
   - `condicao`: itens separados por `;`. Use sempre os mesmos nomes (`caneta azul`, `caneta preta`, `lapis`, `fraca`, `borracha`, `em branco`, `dupla`, `sombra`, `luz amarela`, `torta`), para o relatório agrupar direito.
5. Rode `python poc/avaliar.py` e confira se a sua folha aparece.
