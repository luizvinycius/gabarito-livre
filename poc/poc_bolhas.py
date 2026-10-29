"""PoC v2: acha as bolinhas (A-E) pelo formato e pelo padrão de 5 por linha.
Não depende de marcadores, do tamanho nem da posição da tabela."""
import os
import sys
import cv2
import numpy as np

TARGET_W = 1000
# Largura/altura de um círculo detectado: redondo (monta a grade) entre
# PROPORCAO_RODA; achatado até PROPORCAO_MAX (e 1/PROPORCAO_MAX). Numa foto
# inclinada, as bolinhas longe da câmera viram elipses de até ~1,4.
PROPORCAO_RODA = (0.75, 1.33)
PROPORCAO_MAX = 1.6
# Pontuação mínima de anel (0 a 5) de cada linha escolhida. Nas fotos de
# teste, todas as linhas da tabela tiraram 5,0 e as de fora no máximo 3,6.
# Se alguma linha ficar abaixo do mínimo, a tabela provavelmente está cortada
# e a grade pode estar deslocada: todas as respostas viram "?".
# TODO: recalibrar com o conjunto de fotos (avaliar.py).
MIN_RING = 4.3
# Linha de bolinhas pequenas ou impressas claras (ver suspeita): nas fotos de
# longe ou inclinadas, as linhas da tabela ficaram com anel de 3,5 a 4,3.
MIN_RING_FRACO = 3.4
MIN_DET_FRACO = 3
# Tabela pequena na foto (lida com a imagem 2x maior): o anel borra e as
# linhas da tabela ficaram com 2,7 a 3,4, mesmo com as 5 bolinhas detectadas
# em todas. Com ao menos MIN_DET_FORTE detectadas, basta MIN_RING_DET.
MIN_RING_DET = 2.5
MIN_DET_FORTE = 4
# A pontuação de anel não basta no modelo compacto (grade grossa): lá as
# linhas de "DISSERTATIVA" e o cabeçalho tiram até 5,0. O que separa uma linha
# de bolinhas de uma linha de texto é ter bolinhas detectadas: nas fotos e no
# conjunto sintético, as linhas da tabela costumam ter de 2 a 5 e as de fora,
# 0 (uma linha do meio pode ficar com 0 quando as bolinhas não formam uma
# cadeia de 3). Se a primeira ou a última linha escolhida não tem nenhuma
# bolinha detectada, o bloco provavelmente escorregou para uma linha de texto
# (tabela cortada): todas as respostas viram "?".
# Linha vizinha ao bloco com anel alto e MIN_DET_EXTRA detectadas: a tabela
# tem mais linhas que o gabarito.
MIN_DET_EXTRA = 2
# Folha curvada (column_correction): bolinhas de uma coluna para estimar o
# deslocamento dela e passadas do ajuste alternado (fit_grid).
CURVA_MIN_OBS = 3
CURVA_PASSADAS = 3
# Deslocamento máximo de uma coluna ao longo dela, em passos de linha. No
# conjunto sintético (arco e borda enrolada), a curvatura deu até 0,18; numa
# folha plana, até 0,03; uma coluna com as linhas trocadas, de 0,4 a 0,65.
CURVA_MAX = 0.3
# Ligação de uma cadeia que pula uma coluna (horizontal_chains): não vale se
# houver uma bolinha detectada no vão a menos de PULO_VAO da distância típica
# entre vizinhas da reta que liga as duas pontas.
PULO_VAO = 0.5
# Resgate de uma coluna inteira deslocada (rescue_column): raio de busca
# (fração do passo de uma linha), quanto cada bolinha pode se afastar do
# deslocamento mediano (em raios) e quantas bolinhas no mínimo.
RESGATE_RAIO = 0.45
RESGATE_COERENCIA = 0.5
RESGATE_MIN = 3
# Decisão de cada linha: a segunda bolinha mais escura destaca-se da base mais
# que DUPLA do destaque da primeira: duas marcadas. Entre DUPLA_DUVIDA e DUPLA
# (uma segunda marcação mais fraca, ex.: GS-02 Q6, 50%), é dúvida e o professor
# confirma; abaixo, é rasura leve e vale a primeira.
DUPLA = 0.6
DUPLA_DUVIDA = 0.4
# Tinta da cor do vermelho mais escura que esta fração do papel em volta é
# marcação do aluno e fica (student_ink_gray). Nas fotos do grupo, dentro das
# bolinhas pintadas: caneta escura numa luz quente (marrom) de 0,24 a 0,35 e
# caneta rosa de 0,31 a 0,35, que antes sumiam (a bolinha pintada saía mais
# clara que as vazias e uma dupla virava uma letra só, sem aviso); caneta
# vermelha de 0,42 a 0,47, que continua apagada.
VERMELHO_ESCURO = 0.38

# Foto inteira escolhida da galeria (procurar=True): a folha pode estar
# deitada, de cabeça para baixo, girada ou pequena na foto. A leitura testa
# as 4 orientações da grade e, se não achar a tabela, tenta de novo com a
# imagem ESCALAS[1] vezes maior (bolinhas pequenas demais para o filtro de
# raio de 8 a 40 px).
ESCALAS = (1, 2)
# Pista do lado da folha (side_cue): a orientação certa tira a pista mais
# alta. Nas fotos e no conjunto sintético, ela ficou entre 0,3 e 1,0 na
# orientação certa e com o sinal trocado de cabeça para baixo. Abaixo de
# PISTA_MINIMA não dá para saber o lado da folha, e todas as respostas viram
# "?".
PISTA_MINIMA = 0.1
LADO_DISTANCIAS = (1.3, 1.7, 2.1)
LADO_PASSOS = tuple(0.25 + 0.025 * i for i in range(21))
# Um caminho da pista só conta se passar só por papel: o fundo (a mediana
# larga do normalize_light) em cada ponto, dividido pelo do meio da tabela, a
# partir de LADO_PAPEL. Nas fotos do grupo, o papel ficou de 0,84 a 1,4 e a
# mesa de madeira, o piso e o pano em volta da folha de 0,18 a 0,62: a
# textura deles imitava as linhas da coluna Questão do lado da E, e a pista
# de uma foto em pé caía para perto de 0.
LADO_PAPEL = 0.75
# A foto como está (sem girar 90° ou 180°) só perde para outra orientação se
# a pista dela for maior por mais que esta margem.
MARGEM_EM_PE = 0.05


def student_ink_gray(img):
    """Cinza onde a caneta vermelha do professor vira branco. Só o vermelho
    claro: a caneta escura numa luz quente (marrom) e a caneta rosa também
    caem na faixa de cor do vermelho, mas ficam bem mais escuras que o papel
    em volta (ver VERMELHO_ESCURO)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    red = cv2.inRange(hsv, (0, 60, 40), (12, 255, 255)) | cv2.inRange(hsv, (155, 60, 40), (180, 255, 255))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    red[gray < VERMELHO_ESCURO * light_background(gray)] = 0
    gray[cv2.dilate(red, np.ones((3, 3), np.uint8)) > 0] = 255
    return gray


def find_circles(gray):
    """Círculos (x, y, r, redondo). redondo: largura/altura até PROPORCAO_RODA;
    só esses montam a grade. Os outros (até PROPORCAO_MAX) são bolinhas
    achatadas pela perspectiva e só contam como bolinha detectada numa
    posição que a grade já previu (um "0" do texto da coluna Questão também
    passaria por elas)."""
    b = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 8)
    cnts, _ = cv2.findContours(b, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cnts:
        area = cv2.contourArea(c)
        if area < 150:
            continue
        (x, y), r = cv2.minEnclosingCircle(c)
        per = cv2.arcLength(c, True)
        circ = 4 * np.pi * area / (per * per) if per else 0
        bx, by, bw, bh = cv2.boundingRect(c)
        if circ > 0.6 and 1 / PROPORCAO_MAX < bw / bh < PROPORCAO_MAX and 8 < r < 40:
            out.append((x, y, r, PROPORCAO_RODA[0] < bw / bh < PROPORCAO_RODA[1]))
    # remove duplicados (contorno interno/externo do mesmo anel): primeiro
    # entre os redondos, como antes; os achatados só entram onde não há um
    # redondo (um contorno achatado maior não apaga um redondo dentro dele)
    out.sort(key=lambda t: -t[2])
    keep = []
    for primeiro in (True, False):
        for x, y, r, redondo in out:
            if redondo == primeiro and all((x - kx) ** 2 + (y - ky) ** 2 > (0.6 * kr) ** 2 for kx, ky, kr, _ in keep):
                keep.append((x, y, r, redondo))
    return keep


def circle_shape(r):
    """Forma (a, b, c, d) de um círculo de raio r: o ponto do ângulo t fica em
    (a cos t + b sin t, c cos t + d sin t) a partir do centro."""
    return (r, 0.0, 0.0, r)


def ring_score(norm, x, y, forma):
    """0 a 1: quanto (x, y) parece uma bolinha impressa, isto é, um anel
    escuro com papel claro em volta. None se cair fora da imagem.
    forma (a, b, c, d): a elipse que a bolinha ocupa na foto (circle_shape(r)
    para um círculo); numa foto inclinada, as bolinhas longe da câmera ficam
    achatadas, e o anel e o papel em volta são procurados nessa elipse.
    Procura o anel numa vizinhança pequena (até 0,3 raio de deslocamento),
    porque a grade erra alguns pixels nas pontas.
    (Usar esse centro ajustado para medir o preenchimento foi testado e
    piorou: numa bolinha pintada o melhor anel nem sempre fica no centro.)"""
    a, b, c, d = forma
    h, w = norm.shape
    # margem: o ponto mais longe amostrado (papel em volta, a 1,4 da elipse,
    # com o centro deslocado até 0,3); no círculo, 1,8 raio
    ex = max(1.8 * np.hypot(a, b), 1.4 * np.hypot(a, b) + 0.3 * (abs(a) + abs(b)))
    ey = max(1.8 * np.hypot(c, d), 1.4 * np.hypot(c, d) + 0.3 * (abs(c) + abs(d)))
    if not (ex <= x < w - ex and ey <= y < h - ey):
        return None
    ang = np.linspace(0, 2 * np.pi, 24, endpoint=False)
    ox = a * np.cos(ang) + b * np.sin(ang)
    oy = c * np.cos(ang) + d * np.sin(ang)

    def dark(cx, cy, f):
        xs = (cx + f * ox).astype(int)
        ys = (cy + f * oy).astype(int)
        return (255 - norm[ys, xs].astype(float)) / 255

    best = 0.0
    for dx in (-0.3, 0, 0.3):
        for dy in (-0.3, 0, 0.3):
            cx, cy = x + dx * a + dy * b, y + dx * c + dy * d
            ring = np.max([dark(cx, cy, f) for f in (0.7, 0.8, 0.9, 1.0, 1.1)], axis=0).mean()
            best = max(best, ring - dark(cx, cy, 1.4).mean())
    return float(np.clip(best / 0.3, 0, 1))


def fit_affine(obs):
    """Grade afim (coluna, linha) -> (x, y). None se os pontos estão todos
    numa linha ou numa coluna só."""
    A = np.c_[np.ones(len(obs)), obs[:, 1], obs[:, 0]]
    if len(obs) < 3 or np.linalg.matrix_rank(A) < 3:
        return None
    cx, *_ = np.linalg.lstsq(A, obs[:, 2], rcond=None)
    cy, *_ = np.linalg.lstsq(A, obs[:, 3], rcond=None)
    return lambda ci, ri: (float(cx @ [1, ci, ri]), float(cy @ [1, ci, ri]))


def fit_projective(obs, rmed, r_lo, r_hi):
    """Grade projetiva (homografia) (coluna, linha) -> (x, y): acompanha a
    perspectiva de uma foto inclinada, em que as linhas e as colunas mais
    perto da câmera ficam mais espaçadas (a grade afim escorrega uma linha).
    Mínimos quadrados lineares (DLT com h33 = 1) pelas equações normais, as
    mesmas do app. Precisa de pontos em 3 linhas e 3 colunas; None se não der
    ou se a perspectiva estimada for absurda entre as linhas r_lo e r_hi (a
    grade é prevista até n_q linhas fora das detectadas)."""
    cols, rows = obs[:, 1], obs[:, 0]
    if len(obs) < 6 or len(set(rows)) < 3 or len(set(cols)) < 3:
        return None
    mx, my, s = obs[:, 2].mean(), obs[:, 3].mean(), 10 * rmed
    X, Y = (obs[:, 2] - mx) / s, (obs[:, 3] - my) / s
    z, u = np.zeros(len(obs)), np.ones(len(obs))
    M = np.r_[np.c_[cols, rows, u, z, z, z, -cols * X, -rows * X],
              np.c_[z, z, z, cols, rows, u, -cols * Y, -rows * Y]]
    try:
        h = np.linalg.solve(M.T @ M, M.T @ np.r_[X, Y])
    except np.linalg.LinAlgError:
        return None
    for ci in (0, 4):
        for ri in (r_lo, r_hi):
            if not 0.5 < h[6] * ci + h[7] * ri + 1 < 2:
                return None

    def prever(ci, ri):
        w = h[6] * ci + h[7] * ri + 1
        return (float(mx + s * (h[0] * ci + h[1] * ri + h[2]) / w),
                float(my + s * (h[3] * ci + h[4] * ri + h[5]) / w))
    return prever


def group_rows(circles, n_q, anel):
    """Estima a grade (linhas x 5 colunas) a partir das bolinhas detectadas,
    mesmo que algumas faltem, e devolve as posições de TODAS as bolinhas,
    a pontuação de anel (0 a 5) e o número de bolinhas detectadas de cada
    linha, quantas linhas de bolinhas há fora do bloco escolhido e, por
    coluna, as bolinhas detectadas nas colunas A a E do bloco seguidas das
    redondas na coluna antes da A e na depois da E (7 números):
    (rows, rings, dets, extras, rmed, cols).
    circles: (x, y, r, redondo) do find_circles.
    anel(x, y, forma): pontuação de anel (0 a 1) da posição, ou None se cair
    fora da imagem."""
    vazio = [], [], [], 0, 0.0, []
    todos = np.array([c[:3] for c in circles], float)
    redondo = np.array([bool(c[3]) for c in circles])
    circles = [c[:3] for c in circles if c[3]]
    if not circles:
        return vazio
    # 5. fica com os redondos do tamanho dominante
    rmed = np.median([c[2] for c in circles])
    circles = [c for c in circles if 0.75 * rmed < c[2] < 1.3 * rmed]
    rmed = np.median([c[2] for c in circles])

    cadeias = horizontal_chains(circles, rmed)
    if cadeias is None:
        return vazio
    chains, sp = cadeias
    obs = chain_observations(chains, column_centers(chains, sp), sp, rmed)
    if len(obs) < 3:
        return vazio
    ajuste = robust_fit(np.array(obs, float), rmed, n_q)
    if ajuste is None:
        return vazio
    obs, prever = grow_grid(*ajuste, todos, rmed, n_q)
    posicao = grid_shape(obs, prever, rmed)

    # o professor já informou quantas questões há: escolhe as n_q linhas
    # seguidas com mais evidência. A evidência de cada linha é o número de
    # bolinhas detectadas nela mais a pontuação de anel nas 5 posições
    # previstas. Testa também linhas acima e abaixo das detectadas, porque a
    # questão 1 (ou a última) pode não ter sido detectada.
    cand = {}
    for ri in range(int(obs[:, 0].min()) - n_q, int(obs[:, 0].max()) + n_q + 1):
        pos = [posicao(ci, ri) for ci in range(5)]
        sc = [anel(x, y, f) for x, y, _, f in pos]
        if None in sc:
            continue  # linha fora da imagem
        achou = detections(todos, redondo, pos)
        # colunas logo antes da A e logo depois da E: com bolinhas redondas,
        # a grade está uma coluna para o lado (ver suspeita)
        vizinhas = [red for _, red in detections(todos, redondo, [posicao(-1, ri), posicao(5, ri)])]
        cand[ri] = (pos, sum(sc), sum(a for a, _ in achou), [a for a, _ in achou] + vizinhas)
    bloco = choose_block(cand, n_q)
    if bloco is None:
        return vazio
    s0, extras = bloco
    escolhidas = [cand[ri] for ri in range(s0, s0 + n_q)]
    rows = [[(x, y, r) for x, y, r, _ in c[0]] for c in escolhidas]
    rings = [c[1] for c in escolhidas]
    dets = [int(c[2]) for c in escolhidas]
    # detectadas em cada coluna A a E e redondas nas colunas antes da A e
    # depois da E
    cols = [sum(c[3][ci] for c in escolhidas) for ci in range(7)]
    return rows, rings, dets, extras, rmed, cols


def horizontal_chains(circles, rmed):
    """6. Encadeia vizinhos horizontais (union-find): distância de 2 a 12
    raios, desnível menor que 0,9 raio. Devolve (cadeias de 3 ou mais
    bolinhas, espaçamento entre colunas), ou None se não houver cadeia."""
    n = len(circles)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    # distância típica até a vizinha mais próxima (o passo de uma linha, em
    # geral): mede quão perto da ligação uma bolinha do vão está
    vizinha = np.median([min(np.hypot(c[0] - o[0], c[1] - o[1]) for o in circles if o is not c)
                         for c in circles]) if n > 1 else 0.0

    def atravessa(xi, yi, xj, yj):
        """A ligação pula uma bolinha detectada que está quase na reta entre
        as duas pontas: a linha continua por ela, e a ponta j é da linha de
        baixo ou de cima (folha curvada, r-07)."""
        for xk, yk, _ in circles:
            if xi + 0.25 * (xj - xi) < xk < xj - 0.25 * (xj - xi):
                if abs(yk - (yi + (yj - yi) * (xk - xi) / (xj - xi))) < PULO_VAO * vizinha:
                    return True
        return False

    gaps = []
    for i in range(n):
        xi, yi, _ = circles[i]
        best, bd = None, 1e9
        for j in range(n):
            xj, yj, _ = circles[j]
            dx, dy = xj - xi, abs(yj - yi)
            if 2 * rmed < dx < 12 * rmed and dy < 0.9 * rmed and dx < bd and not atravessa(xi, yi, xj, yj):
                best, bd = j, dx
        if best is not None:
            parent[find(i)] = find(best)
            gaps.append(bd)
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(circles[i])
    chains = [g for g in groups.values() if len(g) >= 3]
    if not chains:
        return None
    return chains, np.percentile(gaps, 30)  # espaçamento entre colunas (vizinhos diretos)


def column_centers(chains, sp):
    """7. x das colunas A a E: agrupa os x de todas as bolinhas das cadeias e
    fica com os 5 grupos vizinhos mais povoados."""
    xs = np.sort([c[0] for g in chains for c in g])
    clusters, cur = [], [xs[0]]
    for x in xs[1:]:
        if x - cur[-1] < sp / 2:
            cur.append(x)
        else:
            clusters.append(cur); cur = [x]
    clusters.append(cur)
    centers = [np.mean(c) for c in clusters]
    counts = [len(c) for c in clusters]
    k0 = max(range(max(1, len(centers) - 4)), key=lambda k: sum(counts[k:k + 5]))
    return centers[k0:k0 + 5]


def chain_observations(chains, centers, sp, rmed):
    """8. (linha, coluna, x, y) de cada bolinha das cadeias. As cadeias em
    ordem de y; cada uma fica round(distância / espaçamento) linhas depois da
    anterior. Contar a partir da vizinha, e não da primeira, aguenta a
    perspectiva (linhas mais espaçadas perto da câmera)."""
    chains = sorted(chains, key=lambda g: np.mean([c[1] for c in g]))
    ys = [np.mean([c[1] for c in g]) for g in chains]
    rsp = max(np.median(np.diff(ys)), rmed) if len(ys) > 1 else 4 * rmed
    idx = [0]
    for k in range(1, len(ys)):
        idx.append(idx[-1] + int(round((ys[k] - ys[k - 1]) / rsp)))
    obs = []
    for ri, g in zip(idx, chains):
        for x, y, _ in g:
            d = [abs(x - cx) for cx in centers]
            ci = int(np.argmin(d))
            if d[ci] < sp * 0.35:
                obs.append((ri, ci, x, y))
    return obs


def fit_grid(obs, rmed, n_q):
    """Grade (coluna, linha) -> (x, y): projetiva quando dá, afim quando não,
    mais a correção de cada coluna (column_correction) para a folha curvada."""
    lo, hi = obs[:, 0].min() - n_q, obs[:, 0].max() + n_q
    base = fit_projective(obs, rmed, lo, hi) or fit_affine(obs)
    if base is None:
        return None
    corr = column_correction(obs, base)
    # A base ajustada com as bolinhas da folha curvada se entorta para
    # acompanhá-las e, fora das linhas observadas, escorrega (na r-07, a
    # questão 1 da coluna A caía uma linha acima). Ajustada de novo sem a
    # correção das colunas, ela fica plana e a curvatura fica nas colunas.
    for _ in range(CURVA_PASSADAS):
        plana = obs.copy()
        for k, (r, c, _, _) in enumerate(obs):
            plana[k, 2:] -= corr(c, r)
        nova = fit_projective(plana, rmed, lo, hi) or fit_affine(plana)
        if nova is None:
            break
        base = nova
        corr = column_correction(obs, base)

    def prever(ci, ri):
        x, y = base(ci, ri)
        dx, dy = corr(ci, ri)
        return x + dx, y + dy
    return prever


def column_correction(obs, base):
    """Folha curvada: a homografia supõe papel plano. Numa folha arqueada, o
    meio de cada linha sobe em relação às pontas (r-02); com a borda do
    papel enrolada, a coluna E inteira desce meia linha (r-07). Cada coluna
    com ao menos CURVA_MIN_OBS bolinhas ganha um deslocamento linear ao longo
    dela (pelos resíduos da grade base, por mínimos quadrados), constante
    fora das linhas observadas; a coluna sem bolinhas bastantes usa o da
    coluna mais próxima que tem (empate: a da esquerda). Entre duas colunas
    (forma das bolinhas), interpolado; antes da A e depois da E, o da A e o
    da E. Devolve corr(ci, ri) -> (dx, dy).
    Um deslocamento ao longo da coluna maior que CURVA_MAX do passo de uma
    linha não é curvatura: é a coluna com as linhas trocadas (na r-07, uma
    cadeia ligou o A da questão 1 ao C e ao D da 2), e a coluna fica sem
    correção, para o ajuste robusto descartar essas bolinhas."""
    pontos = {}
    for r, c, x, y in obs:
        px, py = base(c, r)
        pontos.setdefault(int(c), []).append((r, x - px, y - py))
    ajuste = {}
    for c, pts in pontos.items():
        if len(pts) < CURVA_MIN_OBS:
            continue
        rs = np.array([p[0] for p in pts])
        rm = rs.mean()
        var = ((rs - rm) ** 2).mean()
        coef = []
        for d in (np.array([p[1] for p in pts]), np.array([p[2] for p in pts])):
            dm = d.mean()
            inc = ((rs - rm) * (d - dm)).mean() / var if var > 0 else 0.0
            coef.append((dm - inc * rm, inc))
        # deslocamento ao longo da coluna (na direção do passo de uma linha),
        # nas pontas das linhas observadas
        (ax, bx), (ay, by) = coef
        (x0, y0), (x1, y1) = base(c, rm), base(c, rm + 1)
        ux, uy = x1 - x0, y1 - y0
        passo2 = ux * ux + uy * uy
        if max(abs((ax + bx * r) * ux + (ay + by * r) * uy) for r in (rs.min(), rs.max())) > CURVA_MAX * passo2:
            continue
        ajuste[c] = (coef, rs.min(), rs.max())
    if not ajuste:
        return lambda ci, ri: (0.0, 0.0)
    por_coluna = [ajuste[min(ajuste, key=lambda k: (abs(k - c), k))] for c in range(5)]

    def na_coluna(c, ri):
        (ax, bx), (ay, by) = por_coluna[c][0]
        r = min(max(ri, por_coluna[c][1]), por_coluna[c][2])
        return ax + bx * r, ay + by * r

    def corr(ci, ri):
        ci = min(max(ci, 0.0), 4.0)
        c0 = min(int(np.floor(ci)), 3)
        t = ci - c0
        (x0, y0), (x1, y1) = na_coluna(c0, ri), na_coluna(c0 + 1, ri)
        return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
    return corr


def robust_fit(obs, rmed, n_q):
    """9. Ajuste da grade descartando pontos fora do padrão. Devolve (obs que
    ficaram, prever), ou None se não der para estimar a grade (tudo numa
    linha ou numa coluna só)."""
    for _ in range(3):
        prever = fit_grid(obs, rmed, n_q)
        if prever is None:
            return None
        res = np.array([np.hypot(*np.subtract(prever(c, r), (x, y))) for r, c, x, y in obs])
        keep = res < max(0.4 * rmed, np.percentile(res, 90))
        if keep.all():
            break
        obs = obs[keep]
        if len(obs) < 3:
            return None
    prever = fit_grid(obs, rmed, n_q)
    return None if prever is None else (obs, prever)


def grow_grid(obs, prever, todos, rmed, n_q):
    """A grade cresce linha a linha: entram os círculos (inclusive os
    achatados e os que ficaram fora das cadeias) que caem numa posição
    prevista das linhas já usadas ou vizinhas, e a grade é reajustada. Numa
    foto inclinada, só as linhas perto da câmera formam cadeias, e a grade
    projetiva tirada só delas erra as linhas do fundo. Devolve (obs, prever)."""
    def casar(p, ri, ci):
        x, y = p(ci, ri)
        d = np.hypot(todos[:, 0] - x, todos[:, 1] - y)
        j = int(np.argmin(d))
        ok = d[j] < 0.5 * rmed and 0.6 * rmed < todos[j, 2] < 1.6 * rmed
        return (ri, ci, todos[j, 0], todos[j, 1]) if ok else None

    def crescer(obs, prever):
        for _ in range(n_q):
            lo, hi = int(obs[:, 0].min()) - 1, int(obs[:, 0].max()) + 1
            novos = [c for c in (casar(prever, ri, ci) for ri in range(lo, hi + 1) for ci in range(5)) if c]
            if len(novos) <= len(obs):
                break
            o = np.array(novos, float)
            p = fit_grid(o, rmed, n_q)
            if p is None:
                break
            obs, prever = o, p
        return obs, prever

    obs, prever = crescer(obs, prever)
    if {int(c) for c in obs[:, 1]} == {0, 1, 2, 3}:
        # só 4 colunas nas cadeias, numeradas de 0 a 3: a que falta é a A
        # (folha arqueada, r-07: o A não fica na altura do B de nenhuma
        # linha) ou a E. Fica o lado com mais bolinhas resgatadas.
        esq, dir_ = rescue_column(obs, prever, todos, rmed, -1), rescue_column(obs, prever, todos, rmed, 4)
        if len(esq) > len(dir_):
            o = obs.copy()
            o[:, 1] += 1
            o = np.vstack([o, np.array([(r, 0, x, y) for r, _, x, y in esq], float)])
            p = fit_grid(o, rmed, n_q)
            if p is not None:
                obs, prever = crescer(o, p)
    resgatadas = [o for ci in range(5) for o in rescue_column(obs, prever, todos, rmed, ci)]
    if resgatadas:
        o = np.vstack([obs, np.array(resgatadas, float)])
        p = fit_grid(o, rmed, n_q)
        if p is not None:
            obs, prever = crescer(o, p)
    return obs, prever


def rescue_column(obs, prever, todos, rmed, ci):
    """Coluna inteira deslocada (borda do papel enrolada, r-07): as bolinhas
    dela caem a mais de 0,5 raio da posição prevista e nenhuma entra na
    grade. Nas linhas observadas em que a coluna ci não tem bolinha, procura
    o círculo mais perto a menos de RESGATE_RAIO do passo de uma linha; os
    que se deslocaram como a mediana deles (até RESGATE_COERENCIA raio)
    entram, se forem ao menos RESGATE_MIN. Devolve as observações novas
    (linha, coluna, x, y)."""
    lo, hi = int(obs[:, 0].min()), int(obs[:, 0].max())
    tem = {int(r) for r, c, _, _ in obs if int(c) == ci}
    cand = []
    for ri in range(lo, hi + 1):
        if ri in tem:
            continue
        x, y = prever(ci, ri)
        x1, y1 = prever(ci, ri + 1)
        d = np.hypot(todos[:, 0] - x, todos[:, 1] - y)
        j = int(np.argmin(d))
        if d[j] < RESGATE_RAIO * np.hypot(x1 - x, y1 - y) and 0.6 * rmed < todos[j, 2] < 1.6 * rmed:
            cand.append((ri, ci, todos[j, 0], todos[j, 1], todos[j, 0] - x, todos[j, 1] - y))
    if len(cand) < RESGATE_MIN:
        return []
    mx, my = np.median([c[4] for c in cand]), np.median([c[5] for c in cand])
    bons = [c[:4] for c in cand if np.hypot(c[4] - mx, c[5] - my) < RESGATE_COERENCIA * rmed]
    return bons if len(bons) >= RESGATE_MIN else []


def grid_shape(obs, prever, rmed):
    """posicao(ci, ri) -> (x, y, raio equivalente, forma) de cada bolinha.
    Na perspectiva, as bolinhas longe da câmera ficam menores e achatadas, na
    mesma proporção dos passos de uma coluna e de uma linha da grade naquele
    ponto. As bolinhas detectadas (redondas, de raio rmed) são a referência.
    Na grade afim sem inclinação, a forma é o círculo de raio rmed em toda a
    tabela."""
    def eixos(ci, ri):
        (x0, y0), (x1, y1) = prever(ci - 0.5, ri), prever(ci + 0.5, ri)
        (x2, y2), (x3, y3) = prever(ci, ri - 0.5), prever(ci, ri + 0.5)
        return (x1 - x0, y1 - y0), (x3 - x2, y3 - y2)
    passos = [eixos(c, r) for r, c, _, _ in obs]
    ref_c = np.median([np.hypot(*e[0]) for e in passos])
    ref_r = np.median([np.hypot(*e[1]) for e in passos])

    def posicao(ci, ri):
        x, y = prever(ci, ri)
        (cx, cy), (rx, ry) = eixos(ci, ri)
        f = (rmed * cx / ref_c, rmed * rx / ref_r, rmed * cy / ref_c, rmed * ry / ref_r)
        return x, y, float(np.sqrt(abs(f[0] * f[3] - f[1] * f[2]))), f
    return posicao


def detections(todos, redondo, pos):
    """Para cada posição (x, y, r, forma), (há um círculo detectado ali, há um
    redondo): perto (menos de 0,5 r) e de tamanho compatível, inclusive os
    achatados e os que ficaram fora das cadeias."""
    achou = []
    for x, y, r, _ in pos:
        d = np.hypot(todos[:, 0] - x, todos[:, 1] - y)
        perto = (d < 0.5 * r) & (todos[:, 2] > 0.6 * r) & (todos[:, 2] < 1.6 * r)
        achou.append((bool(np.any(perto)), bool(np.any(perto & redondo))))
    return achou


def choose_block(cand, n_q):
    """10. As n_q linhas seguidas com mais evidência (anel + detectadas).
    Devolve (primeira linha, linhas a mais), ou None se não couber.
    Linhas de bolinhas logo acima ou logo abaixo do bloco: a tabela tem mais
    linhas que o gabarito (ex.: folha de 10 questões com gabarito de 8). Aí a
    questão 1 é a primeira linha da tabela: o bloco sobe até ela. Vale também
    a linha fraca que suspeita() aceita: senão, numa foto de longe de uma
    tabela com linhas a mais, o bloco ficaria onde caiu (a questão 1 lida da
    2ª linha da tabela) sem aviso."""
    blocks = [k for k in cand if all(k + j in cand for j in range(n_q))]
    if not blocks:
        return None
    s0 = max(blocks, key=lambda k: sum(cand[k + j][1] + cand[k + j][2] for j in range(n_q)))

    def bolinhas(ri):
        if ri not in cand:
            return False
        ring, det = cand[ri][1], cand[ri][2]
        return ((ring >= MIN_RING and det >= MIN_DET_EXTRA) or (ring >= MIN_RING_FRACO and det >= MIN_DET_FRACO)
                or (ring >= MIN_RING_DET and det >= MIN_DET_FORTE))
    while bolinhas(s0 - 1):
        s0 -= 1
    extras = 0
    while bolinhas(s0 + n_q + extras):
        extras += 1
    return s0, extras


def lattice_angle(circles):
    """Ângulo (em radianos, de -45° a 45°) dos eixos da grade de bolinhas na
    foto, pela direção de cada bolinha até a vizinha mais próxima. Como as
    linhas e as colunas são perpendiculares, a média é feita sobre 4 vezes o
    ângulo, que dá o mesmo valor para as 4 direções da grade."""
    circles = [c for c in circles if c[3]]
    if not circles:
        return 0.0
    rmed = np.median([c[2] for c in circles])
    pts = [(x, y) for x, y, r, _ in circles if 0.75 * rmed < r < 1.3 * rmed]
    s4 = c4 = 0.0
    for i, (xi, yi) in enumerate(pts):
        best, bd = None, 1e9
        for j, (xj, yj) in enumerate(pts):
            d = np.hypot(xj - xi, yj - yi)
            if j != i and d < bd:
                best, bd = (xj - xi, yj - yi), d
        if best is not None and 2 * rmed < bd < 12 * rmed:
            t = np.arctan2(best[1], best[0])
            s4 += np.sin(4 * t)
            c4 += np.cos(4 * t)
    return float(np.arctan2(s4, c4) / 4) if s4 or c4 else 0.0


def side_cue(norm, fundo, rows):
    """Pista do lado da folha: as linhas que separam as questões continuam
    pela coluna "Questão", que fica do lado da coluna A; do lado da E, depois
    da borda da tabela, não há linha nenhuma. Para cada vão entre duas linhas
    da grade, mede o contraste (mais escuro menos mais claro) no meio do
    caminho entre elas, a 1,3, 1,7 e 2,1 colunas antes da A e depois da E.
    Devolve o contraste do lado da A menos o do lado da E: positivo com a
    folha na orientação certa, negativo de cabeça para baixo. A borda do
    papel, paralela às colunas, não cria esse contraste. Os caminhos que saem
    do papel (fundo: light_background) não contam (LADO_PAPEL): a textura de
    uma mesa ou de um piso em volta da folha cria contraste."""
    h, w = norm.shape
    ys, xs = zip(*[(c[1], c[0]) for row in rows for c in row])
    papel = LADO_PAPEL * fundo[int(np.mean(ys)), int(np.mean(xs))]

    def lado(col, sinal):
        vals = []
        for a, b in zip(rows, rows[1:]):
            # passo de uma coluna na ponta (A->B ou D->E), e não a média da
            # linha: numa folha arqueada, a linha desce perto da A e da E, e
            # a média mandava o caminho para longe da linha da questão
            # (r-07: pista 0,02 em pé)
            (xa, ya, _), (xb, yb, _) = (a[0], a[1]) if col == 0 else (a[3], a[4])
            ux, uy = xb - xa, yb - ya
            (x0, y0, _), (x1, y1, _) = a[col], b[col]
            for t in LADO_DISTANCIAS:
                ox, oy = x0 + sinal * t * ux, y0 + sinal * t * uy
                perfil = []
                for s in LADO_PASSOS:
                    px, py = int(ox + (x1 - x0) * s), int(oy + (y1 - y0) * s)
                    if not (0 <= px < w and 0 <= py < h) or fundo[py, px] < papel:
                        break
                    perfil.append((255 - float(norm[py, px])) / 255)
                else:
                    vals.append(max(perfil) - min(perfil))
        return float(np.mean(vals)) if vals else None

    # Um lado fora da foto (tabela encostada na borda) conta como sem linhas:
    # se o lado que sobrou é o da A, a pista continua clara; se é o da E, fica
    # perto de 0 e a leitura pede confirmação.
    a, e = lado(0, -1), lado(4, 1)
    return (a or 0.0) - (e or 0.0)


def read_grade(circles, n_q, norm, procurar, fundo=None):
    """Grade da tabela nas 4 orientações (procurar=True) ou só na foto como
    está. Devolve (rows, rings, dets, extras, rmed, cols, incerta), com as
    posições na imagem; incerta: achou a tabela, mas não o lado da folha.
    fundo: o light_background da imagem (para a pista do lado)."""
    def na_orientacao(a):
        # a grade é montada com as posições giradas de -a; o anel e as
        # posições finais voltam para a imagem girando de +a
        cos, sin = np.cos(a), np.sin(a)
        girados = [(x * cos + y * sin, -x * sin + y * cos, r, red) for x, y, r, red in circles]

        def anel(x, y, f):
            fa, fb, fc, fd = f
            return ring_score(norm, x * cos - y * sin, x * sin + y * cos,
                              (fa * cos - fc * sin, fb * cos - fd * sin, fa * sin + fc * cos, fb * sin + fd * cos))
        rows, rings, dets, extras, rmed, cols = group_rows(girados, n_q, anel)
        rows = [[(x * cos - y * sin, x * sin + y * cos, r) for x, y, r in row] for row in rows]
        valida = bool(rows) and not suspeita(rings, dets, cols)
        pista = side_cue(norm, fundo, rows) if valida and procurar else 0.0
        return (rows, rings, dets, extras, rmed, cols), valida, pista

    if not procurar:
        return na_orientacao(0.0)[0] + (False,)
    phi = lattice_angle(circles)
    tentativas = [na_orientacao(phi + k * np.pi / 2) for k in range(4)]
    validas = [k for k in range(4) if tentativas[k][1]]
    if not validas:
        return tentativas[0][0] + (False,)
    k = max(validas, key=lambda k: tentativas[k][2])
    if 0 in validas and tentativas[0][2] >= tentativas[k][2] - MARGEM_EM_PE:
        k = 0  # na dúvida pequena, a foto como está
    return tentativas[k][0] + (tentativas[k][2] < PISTA_MINIMA,)


def suspeita(rings, dets, cols):
    """Tabela cortada ou grade deslocada: alguma linha com anel baixo, ou a
    primeira ou a última linha sem nenhuma bolinha detectada.
    Numa foto de longe ou inclinada, com bolinhas pequenas e impressão clara,
    o anel de uma linha da tabela cai abaixo de MIN_RING. Ela é aceita com
    anel a partir de MIN_RING_FRACO se tiver ao menos MIN_DET_FRACO bolinhas
    detectadas, se cada coluna do bloco tiver bolinhas detectadas em ao menos
    metade das linhas e se as colunas logo antes da A e logo depois da E
    tiverem bolinhas redondas em menos da metade (cols, do group_rows); com
    MIN_DET_FORTE detectadas, a partir de MIN_RING_DET. Com a
    grade uma coluna para o lado, a coluna que caiu fora da tabela fica sem
    bolinhas, e a coluna da tabela que ficou de fora do bloco tem as dela."""
    n = len(rings)
    colunas_ok = bool(cols) and min(cols[:5]) * 2 >= n and max(cols[5:]) * 2 < n
    fraca_ok = lambda v, d: (v >= MIN_RING_FRACO and d >= MIN_DET_FRACO) or (v >= MIN_RING_DET and d >= MIN_DET_FORTE)
    baixo = any(v < MIN_RING and not (colunas_ok and fraca_ok(v, d)) for v, d in zip(rings, dets))
    return baixo or (bool(dets) and 0 in (dets[0], dets[-1]))


def light_background(gray):
    """Cinza do papel em volta de cada pixel (+1). A mediana larga (93 px)
    roda numa cópia a 1/4 do tamanho (23 px), que dá quase o mesmo fundo e é
    ~7x mais rápida."""
    h, w = gray.shape
    small = cv2.resize(gray, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
    return cv2.resize(cv2.medianBlur(small, 23), (w, h), interpolation=cv2.INTER_LINEAR).astype(float) + 1


def normalize_light(gray, fundo=None):
    """Remove sombra/iluminação desigual: escuro relativo ao papel em volta.
    fundo: o light_background(gray), se já calculado."""
    fundo = light_background(gray) if fundo is None else fundo
    return np.clip(gray / fundo * 255, 0, 255).astype(np.uint8)


def fill_ratio(gray, x, y, r):
    m = np.zeros_like(gray)
    cv2.circle(m, (int(x), int(y)), max(2, int(r * 0.6)), 255, -1)
    vals = gray[m > 0].astype(float)
    return float(255 - np.mean(vals)) / 255


def read_sheet(path, dbg_path, n_q, target_w=TARGET_W, procurar=False):
    result, dbg = read_image(cv2.imread(path), n_q, target_w, procurar)
    cv2.imwrite(dbg_path, dbg)
    return result


def read_image(img, n_q, target_w=TARGET_W, procurar=False, detalhes=None):
    """Lê uma imagem já carregada. Devolve (respostas, imagem de depuração).
    target_w: 1000 para a folha inteira, 800 para o recorte do quadro-guia.
    procurar: foto inteira tirada fora do app; testa as 4 orientações e,
    se não achar a tabela, uma escala maior (ESCALAS).
    detalhes: dicionário que recebe 'aneis', 'detectadas' e 'grade' (posições
    na largura target_w), para comparar com o app (avaliar.py --detalhes)."""
    melhor = None
    for fator in ESCALAS if procurar else (1,):
        leitura = read_scaled(img, n_q, target_w * fator, procurar) + (fator,)
        if melhor is None or leitura[2] > melhor[2]:
            melhor = leitura
        if leitura[2] == 2:
            break
    if detalhes is not None:
        _, _, _, (rings, dets, rows), fator = melhor
        detalhes.update(aneis=[float(v) for v in rings], detectadas=list(dets),
                        grade=[[[float(v) / fator for v in c] for c in row] for row in rows])
    return melhor[0], melhor[1]


def read_scaled(img, n_q, target_w, procurar):
    """Lê na largura target_w. Devolve (respostas, depuração, situação,
    (anéis, detectadas, grade)), com situação 2 = tabela lida, 1 = achou a
    tabela mas pede confirmação de tudo (cortada ou lado incerto), 0 = não
    achou."""
    s = target_w / img.shape[1]
    img = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    gray = student_ink_gray(img)
    fundo = light_background(gray)
    norm = normalize_light(gray, fundo)
    rows, rings, dets, extras, rmed, cols, incerta = read_grade(find_circles(gray), n_q, norm, procurar, fundo)
    # tabela cortada (ou grade deslocada), com linhas a mais ou com o lado da
    # folha incerto: o app avisa e aqui todas as respostas viram "?"
    cortada = suspeita(rings, dets, cols)
    suspect = cortada or extras > 0 or incerta
    dbg = img.copy()
    result = []
    for qi, row in enumerate(rows, 1):
        f = np.array([fill_ratio(norm, *c) for c in row])
        order = f.argsort()[::-1]
        top, second, base = f[order[0]], f[order[1]], np.median(f)
        gap = top - base
        if suspect:
            ans = "?"          # tabela cortada, grade deslocada, linhas a mais ou lado incerto
        elif gap < 0.15:
            ans = "?"          # em branco ou incerto: professor confirma
        elif second - base > DUPLA * gap:
            ans = "*"          # duas marcadas
        elif second - base > DUPLA_DUVIDA * gap:
            ans = "?"          # a segunda é forte demais para rasura: professor confirma
        else:
            ans = "ABCDE"[order[0]]
        result.append((qi, ans, [round(v, 2) for v in f]))
        for k, (x, y, r) in enumerate(row):
            on = ans not in "?*" and k == order[0]
            cv2.circle(dbg, (int(x), int(y)), int(r) + 4, (0, 200, 0) if on else (255, 120, 0), 3 if on else 1)
        # rótulo antes da coluna A, na direção E -> A (a folha pode estar girada)
        (xa, ya, _), (xe, ye, _) = row[0], row[4]
        cv2.putText(dbg, f"{qi}:{ans}", (int(xa + (xa - xe) * 0.45), int(ya + (ya - ye) * 0.45 + rmed / 2)),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
    situacao = 0 if not rows else 1 if cortada or incerta else 2
    return result, dbg, situacao, (rings, dets, rows)


if __name__ == "__main__":
    # uso: python poc_bolhas.py <n_questoes> foto1.jpg [foto2.jpg ...]
    here = os.path.dirname(os.path.abspath(__file__))
    n_q = int(sys.argv[1])
    for i, p in enumerate(sys.argv[2:]):
        res = read_sheet(p, os.path.join(here, f"bolhas_{i}.png"), n_q, procurar=True)
        print("==", os.path.basename(p), "|", len(res), "questões")
        print("   respostas:", "".join(a for _, a, _ in res))
        for q in res:
            print("  ", q)
