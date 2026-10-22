"""Gera a folha de respostas de teste (PDF A4, 4 tabelas por página).

Imita as tabelas da Univag vistas nas fotos. Páginas 1 e 2: o modelo das
fotos de referência (coluna "Questão" com ~31% da largura, linha com ~8%,
letra num círculo fino), em 4 tamanhos; a página 1 tem 8 questões e a 2, 10.
Página 3: o modelo compacto (grade grossa, bolinha grande, "01 (0,75)" na
coluna da questão), com proporções diferentes em cada tabela; uma delas
repete a folha real com 8 objetivas e 2 linhas de dissertativa.

Uso: python poc/gerar_folha.py [saida.pdf]
"""

import sys

import pymupdf

MM = 72 / 25.4
A4 = pymupdf.paper_rect("a4")

# Proporções em fração da largura da tabela.
CLASSICO = dict(col_questao=0.31, cabecalho=0.075, linha=0.08, bolinha=0.04, grade_grossa=False)
COMPACTO = dict(col_questao=0.30, cabecalho=0.065, linha=0.075, bolinha=0.056, grade_grossa=True)

LARGURAS_MM = [95, 85, 75, 65]
# Página 3: (largura em mm, questões objetivas, ajustes no estilo compacto).
MISTA = [
    (95, 8, dict(valor="0,75", dissertativas=["0,75", "2,00"])),  # igual à foto
    (90, 10, dict(valor="1,00")),
    (80, 8, dict(linha=0.09, bolinha=0.05)),
    (85, 10, dict(linha=0.065, bolinha=0.05, valor="0,5")),
]
PRETO = (0, 0, 0)
CINZA = (0.45, 0.45, 0.45)
FUNDO = (0.86, 0.86, 0.86)


def texto_centro(page, cx, cy, s, tam, fonte="helv"):
    w = pymupdf.get_text_length(s, fontname=fonte, fontsize=tam)
    page.insert_text((cx - w / 2, cy + tam * 0.35), s, fontname=fonte, fontsize=tam, color=PRETO)


def folha(page, x, y, largura, n, estilo=CLASSICO, valor=None, dissertativas=()):
    """Desenha títulos, campo de código e tabela a partir de (x, y)."""
    w = largura * MM
    t = largura / 95 * 10  # tamanho dos títulos acompanha a escala
    page.insert_text((x, y + t), "FOLHA DE RESPOSTAS", fontname="hebo", fontsize=t)
    tw = pymupdf.get_text_length("FOLHA DE RESPOSTAS", fontname="hebo", fontsize=t)
    page.draw_line((x, y + t * 1.25), (x + tw, y + t * 1.25), color=PRETO, width=t * 0.07)
    codigo = "Código: __________"
    cw = pymupdf.get_text_length(codigo, fontname="helv", fontsize=t)
    page.insert_text((x + w - cw, y + t), codigo, fontname="helv", fontsize=t)
    y += t * 3
    page.insert_text((x, y), "QUESTÕES OBJETIVAS", fontname="hebo", fontsize=t * 0.9)
    y += t * 1.2

    hc, hl = estilo["cabecalho"] * w, estilo["linha"] * w
    qw = estilo["col_questao"] * w
    aw = (w - qw) / 5
    total = n + len(dissertativas)
    alto = hc + total * hl
    page.draw_rect(pymupdf.Rect(x, y, x + w, y + hc), color=None, fill=FUNDO)
    # Clássico: linhas internas finas, borda e divisão do cabeçalho mais
    # fortes. Compacto: grade toda grossa e preta.
    cor, esp = (PRETO, 1.0) if estilo["grade_grossa"] else (CINZA, 0.5)
    for i in range(1, total):
        yy = y + hc + i * hl
        page.draw_line((x, yy), (x + w, yy), color=cor, width=esp)
    for j in range(1, 5):
        xx = x + qw + j * aw
        page.draw_line((xx, y + hc), (xx, y + hc + n * hl), color=cor, width=esp)
    page.draw_line((x, y + hc), (x + w, y + hc), color=PRETO, width=0.9)
    page.draw_line((x + qw, y), (x + qw, y + alto), color=PRETO, width=0.9)
    page.draw_rect(pymupdf.Rect(x, y, x + w, y + alto), color=PRETO, width=1.1)

    tc = hc * 0.5
    texto_centro(page, x + qw / 2, y + hc / 2, "Questão", tc, "hebo")
    texto_centro(page, x + qw + (w - qw) / 2, y + hc / 2, "Respostas", tc, "hebo")
    r = estilo["bolinha"] * w / 2
    compacto = estilo["grade_grossa"]

    def rotulo(i, v):
        s = f"{i + 1:02d}" if compacto else str(i + 1)
        return f"{s} ({v})" if v else s

    tam_rotulo = hl * (0.5 if compacto else 0.42)
    for i in range(n):
        cy = y + hc + (i + 0.5) * hl
        texto_centro(page, x + qw / 2, cy, rotulo(i, valor), tam_rotulo, "hebo")
        for j, letra in enumerate("ABCDE"):
            cx = x + qw + (j + 0.5) * aw
            page.draw_circle((cx, cy), r, color=PRETO, width=max(0.45, r * 0.09))
            texto_centro(page, cx, cy, letra, r * (1.4 if compacto else 1.25))
    for k, v in enumerate(dissertativas):
        cy = y + hc + (n + k + 0.5) * hl
        texto_centro(page, x + qw / 2, cy, rotulo(n + k, v), tam_rotulo, "hebo")
        texto_centro(page, x + qw + (w - qw) / 2, cy, "****DISSERTATIVA****", hl * 0.5)
    return y + alto


def pagina(doc, tabelas, rodape):
    """tabelas: 4 itens (largura em mm, questões, argumentos de folha())."""
    page = doc.new_page(width=A4.width, height=A4.height)
    margem, meio = 10 * MM, A4.width / 2
    cel_h = (A4.height - 2 * margem - 8 * MM) / 2
    for k, (larg, n, extra) in enumerate(tabelas):
        col, lin = k % 2, k // 2
        cx = meio / 2 if col == 0 else meio + meio / 2
        x = cx - larg * MM / 2
        y = margem + lin * cel_h + 4 * MM
        folha(page, x, y, larg, n, **extra)
    # Guias de corte pontilhadas.
    page.draw_line((meio, margem), (meio, A4.height - margem - 8 * MM), color=CINZA, width=0.4, dashes="[2 3] 0")
    yc = margem + cel_h
    page.draw_line((margem, yc), (A4.width - margem, yc), color=CINZA, width=0.4, dashes="[2 3] 0")
    rodape = f"Gabarito Livre: {rodape} (modelo semelhante ao da Univag). Escreva o código (ex.: LV-01) em cada tabela."
    page.insert_text((margem, A4.height - margem), rodape, fontname="helv", fontsize=7, color=CINZA)


def main():
    saida = sys.argv[1] if len(sys.argv) > 1 else "dataset/folha-de-respostas-teste.pdf"
    doc = pymupdf.open()
    for n in (8, 10):
        pagina(doc, [(larg, n, {}) for larg in LARGURAS_MM], f"folha de teste com {n} questões")
    mista = [(larg, n, dict(estilo={**COMPACTO, **{k: v for k, v in a.items() if k in COMPACTO}},
                            **{k: v for k, v in a.items() if k not in COMPACTO}))
             for larg, n, a in MISTA]
    pagina(doc, mista, "folha de teste com 8 e 10 questões, modelo compacto")
    doc.save(saida)
    print(saida)


if __name__ == "__main__":
    main()
