"""Gera o conjunto de teste sintético (dataset/sinteticas/).

Desenha as tabelas da folha de teste (gerar_folha.py), pinta as bolinhas
imitando caneta, lápis, rabisco e borracha e aplica o que acontece numa foto
de verdade: sombra, luz amarela, folha torta, perspectiva, desfoque, ruído,
JPEG forte e a correção em vermelho do professor. Também simula o recorte do
quadro-guia da câmera com a tabela deslocada ou cortada, e tabelas com
linhas a mais ou a menos que o gabarito. Os recortes do quadro-guia também
são feitos a partir da foto real do modelo compacto (dataset/fotos/).

Não substitui as fotos do grupo: serve para conferir, sem esperar fotos, que
uma mudança no leitor não piorou nada. Tudo sai sempre igual (sementes
fixas), então dá para comparar uma execução com a outra.

Uso:
    python poc/gerar_sinteticas.py
    python poc/avaliar.py --conjunto sinteticas
    cd app && npm run avaliar -- --conjunto sinteticas

No CSV, "?" na resposta esperada quer dizer que o app deve pedir
confirmação (tabela cortada, linhas a mais ou a menos): qualquer letra
nessa questão conta como erro silencioso.
"""

import argparse
import csv
import os
import sys

import cv2
import numpy as np
import pymupdf

import gerar_folha as gf

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
DPI = 400
PX = DPI / 72  # pixels por ponto

# Câmera do app (app/src/Camera.tsx): proporção do quadro e margens do recorte.
ALTURA_LINHA_QUADRO = 0.11
MARGEM_X = 0.1
MARGEM_Y = 0.3

# (nome, questões, largura em mm, argumentos de gf.folha())
MODELOS = [
    ("classico8", 8, 95, {}),
    ("classico10", 10, 95, {}),
    ("compacto8d", 8, 95, dict(estilo=gf.COMPACTO, valor="0,75", dissertativas=["0,75", "2,00"])),
    ("compacto10", 10, 95, dict(estilo=gf.COMPACTO, valor="1,00")),
    ("compacto8a", 8, 95, dict(estilo={**gf.COMPACTO, "linha": 0.09, "bolinha": 0.05})),
    ("compacto10b", 10, 95, dict(estilo={**gf.COMPACTO, "linha": 0.065, "bolinha": 0.05}, valor="0,5")),
]

# Cada variação: marcação usada nas questões, efeitos da foto e tipo de imagem.
# 'recorte' imita o quadro-guia (lido a 800 px); 'perto' e 'longe' são a foto
# da folha inteira (lida a 1000 px).
VARIACOES = [
    ("limpa", dict(marca="caneta preta", condicoes=["caneta preta", "luz boa"])),
    ("azul-amarela", dict(marca="caneta azul", luz="amarela", condicoes=["caneta azul", "luz amarela"])),
    ("lapis-sombra", dict(marca="lapis", luz="sombra", condicoes=["lapis", "sombra"])),
    ("fraca-desfoque", dict(marca="fraca", desfoque=1.6, condicoes=["lapis", "fraca", "desfoque"])),
    ("rabiscada-torta", dict(marca="rabiscada", giro=4, condicoes=["caneta azul", "rabiscada", "torta"])),
    ("borracha-perspectiva", dict(marca="borracha", perspectiva=0.08, condicoes=["lapis", "borracha", "perspectiva"])),
    ("jpeg-vermelho", dict(marca="caneta preta", jpeg=30, ruido=7, vermelho=True,
                           condicoes=["caneta preta", "jpeg", "vermelho"])),
    ("perto", dict(marca="caneta azul", tipo="perto", giro=-2, condicoes=["caneta azul", "perto"])),
    ("longe", dict(marca="caneta preta", tipo="longe", luz="sombra", condicoes=["caneta preta", "longe", "sombra"])),
]

# Deslocamento da tabela no quadro, em linhas (positivo: tabela mais baixa).
# Até onde a margem do recorte cobre, a leitura tem de acertar; além disso,
# a tabela fica cortada e o app tem de avisar.
DESLOCAMENTOS_OK = [-2, -1, 0, 1, 2, 3]


def deslocamentos_cortados(n, modelo_kw):
    """Deslocamentos que cortam ~1,5 linha em cima e embaixo da tabela."""
    estilo = modelo_kw.get("estilo", gf.CLASSICO)
    linhas = n + len(modelo_kw.get("dissertativas", ()))
    altura = estilo["cabecalho"] + linhas * estilo["linha"]  # em larguras da tabela
    quadro = (n + 1) * ALTURA_LINHA_QUADRO / 0.95  # o quadro é 5% mais largo que a tabela
    topo = -(MARGEM_Y * quadro + estilo["cabecalho"]) / estilo["linha"] - 1.5
    # embaixo: só as linhas de bolinha importam
    fundo_bolinhas = estilo["cabecalho"] + n * estilo["linha"]
    base = ((1 + MARGEM_Y) * quadro - fundo_bolinhas) / estilo["linha"] + 1.5
    return [round(topo, 1), round(base, 1)], altura


# ---------------------------------------------------------------- desenho

def desenhar_pagina(n, largura, kw):
    """Página com a tabela e texto em volta, como numa prova. Devolve a imagem
    (BGR), as bolinhas e o retângulo da tabela em pixels."""
    doc = pymupdf.open()
    page = doc.new_page(width=gf.A4.width, height=gf.A4.height)
    x0, y0 = 20 * gf.MM, 50 * gf.MM
    page.draw_rect(pymupdf.Rect(x0, 20 * gf.MM, x0 + 170 * gf.MM, 42 * gf.MM), color=gf.PRETO, width=1)
    page.insert_text((x0 + 3 * gf.MM, 27 * gf.MM), "Nome do(a) aluno(a):", fontname="hebo", fontsize=11)
    geo = gf.folha(page, x0, y0, largura, n, **kw)
    y = geo["tabela"].y1 + 12 * gf.MM
    page.insert_text((x0, y), "QUESTÃO DISCURSIVA 1 (Nota: 2,0)", fontname="hebo", fontsize=11)
    for k in range(6):
        yy = y + (8 + 7 * k) * gf.MM
        page.draw_line((x0, yy), (x0 + 170 * gf.MM, yy), color=gf.CINZA, width=0.5)
    pix = page.get_pixmap(dpi=DPI, clip=pymupdf.Rect(0, 0, gf.A4.width, y + 60 * gf.MM))
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)[:, :, :3][:, :, ::-1].copy()
    bolinhas = [[(cx * PX, cy * PX, r * PX) for cx, cy, r in linha] for linha in geo["bolinhas"]]
    t = geo["tabela"]
    return img, bolinhas, (t.x0 * PX, t.y0 * PX, t.x1 * PX, t.y1 * PX), geo["linha"] * PX


COR = {"caneta preta": (35, 35, 40), "caneta azul": (140, 50, 25), "lapis": (85, 85, 85)}


def contorno_irregular(rng, cx, cy, r, k=24):
    ang = np.linspace(0, 2 * np.pi, k, endpoint=False)
    raio = r * rng.uniform(0.85, 1.08, k)
    return np.stack([cx + raio * np.cos(ang), cy + raio * np.sin(ang)], 1).astype(np.int32)


def janela(img, cx, cy, r):
    """Pedaço da imagem em volta da bolinha (para não processar a página
    inteira a cada marcação) e a posição do centro dentro dele."""
    m = int(1.8 * r) + 2
    x0, y0 = max(0, int(cx) - m), max(0, int(cy) - m)
    roi = img[y0:int(cy) + m, x0:int(cx) + m]
    return roi, cx - x0, cy - y0


def misturar(roi, mascara, cor):
    roi[:] = (roi * (1 - mascara[..., None]) + np.array(cor, np.float32) * mascara[..., None]).astype(np.uint8)


def pintar(img, rng, c, tipo, cor):
    """Pinta uma bolinha (cx, cy, r) imitando o tipo de marcação."""
    cx, cy, r = c
    cx += rng.uniform(-0.12, 0.12) * r
    cy += rng.uniform(-0.12, 0.12) * r
    roi, x, y = janela(img, cx, cy, r)
    mascara = np.zeros(roi.shape[:2], np.float32)
    if tipo == "rabiscada":
        # zigue-zague com falhas entre os traços
        k = int(rng.integers(5, 8))
        pts = [(x + (-0.9 if i % 2 else 0.9) * r, y - 0.8 * r + i * 1.6 * r / (k - 1)) for i in range(k)]
        cv2.polylines(mascara, [np.array(pts, np.int32)], False, 1.0, max(2, int(r * 0.2)))
        alfa = 0.95
    else:
        cv2.fillPoly(mascara, [contorno_irregular(rng, x, y, r * rng.uniform(0.92, 1.05))], 1.0)
        alfa = {"fraca": 0.42, "lapis": 0.78}.get(tipo, 0.95)
    if tipo in ("lapis", "fraca"):
        # grafite: falhado e com textura
        mascara *= rng.uniform(0.6, 1.0, mascara.shape).astype(np.float32)
        cor = COR["lapis"]
    misturar(roi, cv2.GaussianBlur(mascara, (0, 0), max(0.8, r * 0.04)) * alfa, cor)


def apagar(img, rng, c):
    """Resto de borracha: mancha clara e alguns traços fracos."""
    cx, cy, r = c
    roi, x, y = janela(img, cx, cy, r)
    mascara = np.zeros(roi.shape[:2], np.float32)
    cv2.fillPoly(mascara, [contorno_irregular(rng, x, y, r * 1.1)], 0.22)
    for _ in range(3):
        a, b = rng.uniform(-r, r, 2), rng.uniform(-r, r, 2)
        cv2.line(mascara, (int(x + a[0]), int(y + a[1])), (int(x + b[0]), int(y + b[1])), 0.3, max(1, int(r * 0.12)))
    misturar(roi, cv2.GaussianBlur(mascara, (0, 0), r * 0.3), (90, 90, 90))


def marcar(img, rng, bolinhas, tipo):
    """Escolhe as respostas (com algumas em branco e duplas) e pinta. Devolve
    a string esperada: letra, '_' (em branco) ou '*' (duas)."""
    cor = COR.get(tipo, COR["caneta preta"])
    if tipo in ("rabiscada",):
        cor = COR["caneta azul"]
    esperado = ""
    n = len(bolinhas)
    # posições fixas para branco e dupla, para todo modelo ter os dois casos
    branco = {int(rng.integers(0, n))}
    dupla = {(min(branco) + n // 2) % n}
    for i, linha in enumerate(bolinhas):
        if i in branco:
            esperado += "_"
            if tipo == "borracha":
                apagar(img, rng, linha[int(rng.integers(0, 5))])
            continue
        letras = rng.choice(5, 2, replace=False)
        if i in dupla:
            for k in letras:
                pintar(img, rng, linha[k], "caneta preta" if tipo == "borracha" else tipo, cor)
            esperado += "*"
            continue
        if tipo == "borracha":
            # marcou uma, apagou e marcou outra
            apagar(img, rng, linha[letras[1]])
            pintar(img, rng, linha[letras[0]], "lapis", cor)
        else:
            pintar(img, rng, linha[letras[0]], tipo, cor)
        esperado += "ABCDE"[letras[0]]
    return esperado


def correcao_vermelha(img, rng, bolinhas):
    """Vistos em vermelho à direita das linhas e um risco cruzando a tabela."""
    r = bolinhas[0][0][2]
    x = int(bolinhas[0][4][0] + 3 * r)
    for linha in bolinhas:
        y = int(linha[0][1])
        pts = np.array([(x, y), (x + r, y + r), (x + 3 * r, y - 1.5 * r)], np.int32)
        cv2.polylines(img, [pts], False, (40, 30, 200), max(2, int(r * 0.2)))
    y0, y1 = int(bolinhas[0][0][1]), int(bolinhas[-1][0][1])
    cv2.line(img, (x + int(4 * r), y0), (x - int(2 * r), y1), (50, 40, 210), max(2, int(r * 0.15)))


def iluminar(img, rng, luz, tabela):
    h, w = img.shape[:2]
    f = img.astype(np.float32)
    if luz == "amarela":
        f *= np.array([0.62, 0.86, 1.0], np.float32)
        f = f * 0.92 + 8
    elif luz == "sombra":
        # sombra de mão/celular: mancha escura e suave cobrindo parte da tabela
        x0, y0, x1, y1 = tabela
        mascara = np.zeros((h, w), np.float32)
        cx = int(rng.uniform(x0, x1))
        cv2.ellipse(mascara, (cx, int(y0 + (y1 - y0) * 0.6)), (int((x1 - x0) * 0.45), int((y1 - y0) * 0.5)),
                    float(rng.uniform(0, 180)), 0, 360, 1.0, -1)
        mascara = cv2.GaussianBlur(mascara, (0, 0), (x1 - x0) * 0.06)
        f *= 1 - 0.5 * mascara[..., None]
        # e um gradiente geral de luz
        f *= np.linspace(1.0, 0.8, w, dtype=np.float32)[None, :, None]
    return np.clip(f, 0, 255).astype(np.uint8)


def transformar(img, tabela, giro=0.0, perspectiva=0.0):
    """Gira e/ou aplica perspectiva em volta do centro da tabela. Devolve a
    imagem e os 4 cantos da tabela transformados."""
    x0, y0, x1, y1 = tabela
    cantos = np.float32([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
    h, w = img.shape[:2]
    if perspectiva:
        d = (x1 - x0) * perspectiva / 2
        destino = np.float32([[x0 + d, y0], [x1 - d, y0], [x1, y1], [x0, y1]])
        m = cv2.getPerspectiveTransform(cantos, destino)
    else:
        m = np.eye(3, dtype=np.float32)
    if giro:
        g = cv2.getRotationMatrix2D(((x0 + x1) / 2, (y0 + y1) / 2), giro, 1.0)
        m = np.vstack([g, [0, 0, 1]]).astype(np.float32) @ m
    if not giro and not perspectiva:
        return img, cantos
    saida = cv2.warpPerspective(img, m, (w, h), flags=cv2.INTER_LINEAR, borderValue=(245, 245, 245))
    return saida, cv2.perspectiveTransform(cantos[None], m)[0]


def recortar_quadro(img, cantos, n, linha, deslocamento):
    """Imita o quadro-guia: largura da tabela = 95% do quadro, cabeçalho na
    faixa de cima, tabela deslocada 'deslocamento' linhas; recorte com as
    margens do app."""
    topo_esq, topo_dir = cantos[0], cantos[1]
    largura_tab = float(np.hypot(*(topo_dir - topo_esq)))
    qw = largura_tab / 0.95
    qh = qw * (n + 1) * ALTURA_LINHA_QUADRO
    cx = float(cantos[:, 0].mean())
    qx = cx - qw / 2
    qy = float(min(topo_esq[1], topo_dir[1])) - deslocamento * linha
    x0 = int(max(0, qx - MARGEM_X * qw))
    x1 = int(min(img.shape[1], qx + qw + MARGEM_X * qw))
    y0 = int(max(0, qy - MARGEM_Y * qh))
    y1 = int(min(img.shape[0], qy + qh + MARGEM_Y * qh))
    return img[y0:y1, x0:x1]


def recortar_foto(img, cantos, fracao):
    """Foto da folha inteira: a tabela ocupa 'fracao' da largura da imagem."""
    largura_tab = float(cantos[:, 0].max() - cantos[:, 0].min())
    w = largura_tab / fracao
    h = w * 4 / 3
    cx, cy = float(cantos[:, 0].mean()), float(cantos[:, 1].mean())
    x0, y0 = int(max(0, cx - w / 2)), int(max(0, cy - h * 0.45))
    return img[y0:int(y0 + h), x0:int(x0 + w)]


def acabar(img, rng, largura, desfoque=0.0, ruido=0.0, jpeg=92):
    """Tamanho final de câmera, desfoque e ruído. Devolve os bytes do JPEG."""
    escala = largura / img.shape[1]
    img = cv2.resize(img, None, fx=escala, fy=escala, interpolation=cv2.INTER_AREA)
    if desfoque:
        img = cv2.GaussianBlur(img, (0, 0), desfoque)
    if ruido:
        img = np.clip(img + rng.normal(0, ruido, img.shape), 0, 255).astype(np.uint8)
    ok, dados = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, jpeg])
    assert ok
    return dados


# ---------------------------------------------------------------- conjunto

def gerar(pasta):
    fotos = os.path.join(pasta, "fotos")
    os.makedirs(fotos, exist_ok=True)
    # apaga só os arquivos: a pasta pode estar aberta (OneDrive, terminal)
    for antigo in os.listdir(fotos):
        os.remove(os.path.join(fotos, antigo))
    linhas = []

    def salvar(nome, dados, n, esperado, condicoes):
        with open(os.path.join(fotos, nome), "wb") as f:
            f.write(dados.tobytes())
        linhas.append([nome, n, esperado, "sintetica", "; ".join(condicoes)])

    for m, (nome_m, n, largura, kw) in enumerate(MODELOS):
        modelo = "modelo compacto" if "estilo" in kw else "modelo classico"
        base, bolinhas, tabela, linha = desenhar_pagina(n, largura, kw)

        for v, (nome_v, op) in enumerate(VARIACOES):
            rng = np.random.default_rng(1000 * m + v)
            img = base.copy()
            esperado = marcar(img, rng, bolinhas, op["marca"])
            if op.get("vermelho"):
                correcao_vermelha(img, rng, bolinhas)
            img = iluminar(img, rng, op.get("luz"), tabela)
            img, cantos = transformar(img, tabela, op.get("giro", 0), op.get("perspectiva", 0))
            tipo = op.get("tipo", "recorte")
            if tipo == "recorte":
                img = recortar_quadro(img, cantos, n, linha, 0)
                arquivo, largura_px = f"recorte-{nome_m}-{nome_v}.jpg", 1400
            else:
                img = recortar_foto(img, cantos, 0.75 if tipo == "perto" else 0.42)
                arquivo, largura_px = f"{nome_m}-{nome_v}.jpg", 1600
            dados = acabar(img, rng, largura_px, op.get("desfoque", 0), op.get("ruido", 0), op.get("jpeg", 92))
            salvar(arquivo, dados, n, esperado, [modelo, f"{n} questoes"] + op["condicoes"])

        # Enquadramento: mesma folha marcada, tabela deslocada no quadro.
        if nome_m in ("classico8", "compacto8d", "compacto10b"):
            rng = np.random.default_rng(5000 + m)
            img = base.copy()
            esperado = marcar(img, rng, bolinhas, "caneta azul")
            cantos = np.float32([[tabela[0], tabela[1]], [tabela[2], tabela[1]],
                                 [tabela[2], tabela[3]], [tabela[0], tabela[3]]])
            cortados, _ = deslocamentos_cortados(n, kw)
            for d in DESLOCAMENTOS_OK + cortados:
                rec = recortar_quadro(img, cantos, n, linha, d)
                cortada = d in cortados
                salvar(f"recorte-{nome_m}-deslocada{d:+g}.jpg", acabar(rec, rng, 1400), n,
                       "?" * n if cortada else esperado,
                       [modelo, f"{n} questoes", "caneta azul", "cortada" if cortada else "deslocada"])

    # Linhas a mais ou a menos que o gabarito: o app tem de avisar.
    for nome_m, n_gab, condicao in [("classico10", 8, "linhas a mais"), ("compacto10", 8, "linhas a mais"),
                                    ("classico8", 10, "linhas a menos"), ("compacto8d", 10, "linhas a menos")]:
        _, n, largura, kw = next(md for md in MODELOS if md[0] == nome_m)
        modelo = "modelo compacto" if "estilo" in kw else "modelo classico"
        rng = np.random.default_rng(7000 + n_gab + len(linhas))
        img, bolinhas, tabela, linha = desenhar_pagina(n, largura, kw)
        marcar(img, rng, bolinhas, "caneta preta")
        cantos = np.float32([[tabela[0], tabela[1]], [tabela[2], tabela[1]],
                             [tabela[2], tabela[3]], [tabela[0], tabela[3]]])
        # o professor encaixa a tabela no quadro do gabarito (n_gab questões)
        rec = recortar_quadro(img, cantos, n_gab, linha, 0)
        salvar(f"recorte-{nome_m}-gabarito{n_gab}.jpg", acabar(rec, rng, 1400), n_gab, "?" * n_gab,
               [modelo, condicao])

    gerar_recortes_da_foto_real(salvar)

    with open(os.path.join(pasta, "respostas.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["arquivo", "n_questoes", "respostas", "celular", "condicao"])
        w.writerows(linhas)
    return len(linhas)


# Foto real do modelo compacto: posição aproximada da tabela (em pixels da
# foto de 900 x 1600) e as respostas marcadas.
FOTO_REAL = "univag-compacto-01.jpg"
FOTO_REAL_TABELA = (62, 500, 752, 545 + 8 * 52.5)  # cabeçalho até o fim da questão 8
FOTO_REAL_LINHA = 52.5
FOTO_REAL_RESPOSTAS = "BCDBCCCC"


def gerar_recortes_da_foto_real(salvar):
    caminho = os.path.join(RAIZ, "dataset", "fotos", FOTO_REAL)
    img = cv2.imread(caminho)
    if img is None:
        print(f"AVISO: {caminho} não encontrada; sem recortes da foto real")
        return
    x0, y0, x1, y1 = FOTO_REAL_TABELA
    cantos = np.float32([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
    rng = np.random.default_rng(9000)
    n = len(FOTO_REAL_RESPOSTAS)
    cortados, _ = deslocamentos_cortados(n, dict(estilo=gf.COMPACTO, dissertativas=["", ""]))
    for d in DESLOCAMENTOS_OK + cortados[:1]:
        rec = recortar_quadro(img, cantos, n, FOTO_REAL_LINHA, d)
        cortada = d in cortados
        salvar(f"recorte-fotoreal-deslocada{d:+g}.jpg", acabar(rec, rng, rec.shape[1], jpeg=95), n,
               "?" * n if cortada else FOTO_REAL_RESPOSTAS,
               ["modelo compacto", "foto real", "rabiscada", "cortada" if cortada else "deslocada"])


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pasta", default=os.path.join(RAIZ, "dataset", "sinteticas"))
    args = ap.parse_args()
    total = gerar(args.pasta)
    print(f"{total} imagens em {args.pasta}")


if __name__ == "__main__":
    main()
