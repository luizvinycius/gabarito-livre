# Gabarito Livre

Corretor de gabarito pela câmera do celular, **gratuito e open source**. O professor cadastra as respostas certas, aponta a câmera para a tabela de respostas da prova e vê na hora a nota da parte objetiva. Quando a leitura fica em dúvida, o app pergunta em vez de chutar.

> **Situação:** em desenvolvimento (Projeto Integrador 2026, Univag). A leitura já funciona no iPhone e no Android, em cerca de 0,1 s por folha; as telas do app ainda estão sendo feitas. Veja o [backlog](docs/BACKLOG.md).

- **Sem servidor:** a foto é processada no próprio celular e nada é enviado para a internet.
- **Sem folha especial:** lê a tabela de respostas do modelo de prova que o professor já usa.
- **Android e iPhone,** pelo navegador (PWA).

## Estrutura
| Pasta | Conteúdo |
|---|---|
| [`app/`](app/) | App web (React + Vite + TypeScript). A leitura fica em `app/src/omr/` e roda num Web Worker com OpenCV.js |
| [`poc/`](poc/) | Protótipo do algoritmo em Python (`poc_bolhas.py`) e script de avaliação da precisão (`avaliar.py`) |
| [`dataset/`](dataset/) | Conjunto de teste: fotos preenchidas pelo grupo e as respostas certas ([como contribuir](dataset/LEIAME.md)) |
| [`docs/`](docs/) | [Documentação do projeto](docs/DOCUMENTACAO-PROJETO.md) e [backlog](docs/BACKLOG.md) |

## Rodar
```bash
cd app
npm install
npm run dev      # https://<ip-do-pc>:5173; o celular precisa estar na mesma rede
```
Para testar no celular, veja [`app/README.md`](app/README.md).

```bash
pip install opencv-python numpy
python poc/avaliar.py   # mede a precisão no dataset/
```

## Privacidade
Nunca publique fotos de provas reais com nome ou assinatura de alunos. O conjunto de teste usa só folhas preenchidas pelo próprio grupo.

## Licença
[MIT](LICENSE)
