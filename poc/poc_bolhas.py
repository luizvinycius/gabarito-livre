"""PoC v2: acha as bolinhas (A-E) pelo formato e pelo padrão de 5 por linha.
Não depende de marcadores, do tamanho nem da posição da tabela."""
import os
import sys
import cv2
import numpy as np

TARGET_W = 1000


def student_ink_gray(img):
    """Cinza onde a caneta vermelha do professor vira branco."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    red = cv2.inRange(hsv, (0, 60, 40), (12, 255, 255)) | cv2.inRange(hsv, (155, 60, 40), (180, 255, 255))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray[cv2.dilate(red, np.ones((3, 3), np.uint8)) > 0] = 255
    return gray


def find_circles(gray):
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
        if circ > 0.6 and 0.75 < bw / bh < 1.33 and 8 < r < 40:
            out.append((x, y, r))
    # remove duplicados (contorno interno/externo do mesmo anel)
    out.sort(key=lambda t: -t[2])
    keep = []
    for x, y, r in out:
        if all((x - kx) ** 2 + (y - ky) ** 2 > (0.6 * kr) ** 2 for kx, ky, kr in keep):
            keep.append((x, y, r))
    return keep


def group_rows(circles, n_q):
    """Estima a grade (linhas x 5 colunas) a partir das bolinhas detectadas,
    mesmo que algumas faltem, e devolve as posições de TODAS as bolinhas."""
    rmed = np.median([c[2] for c in circles])
    circles = [c for c in circles if 0.75 * rmed < c[2] < 1.3 * rmed]
    rmed = np.median([c[2] for c in circles])
    n = len(circles)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    gaps = []
    for i in range(n):
        xi, yi, _ = circles[i]
        best, bd = None, 1e9
        for j in range(n):
            xj, yj, _ = circles[j]
            dx, dy = xj - xi, abs(yj - yi)
            if 2 * rmed < dx < 12 * rmed and dy < 0.9 * rmed and dx < bd:
                best, bd = j, dx
        if best is not None:
            parent[find(i)] = find(best)
            gaps.append(bd)
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(circles[i])
    chains = [g for g in groups.values() if len(g) >= 3]
    if not chains:
        return [], rmed
    sp = np.percentile(gaps, 30)  # espaçamento entre colunas (vizinhos diretos)

    # colunas: agrupa os x de todas as bolinhas; fica com as 5 colunas mais povoadas e vizinhas
    pts = [c for g in chains for c in g]
    xs = np.sort([c[0] for c in pts])
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
    centers = centers[k0:k0 + 5]

    # linhas: y médio de cada cadeia, convertido em índice pelo espaçamento entre linhas
    ys = sorted(np.mean([c[1] for c in g]) for g in chains)
    rsp = np.median(np.diff(ys)) if len(ys) > 1 else 4 * rmed
    obs = []  # (linha, coluna, x, y)
    for g in chains:
        ri = int(round((np.mean([c[1] for c in g]) - ys[0]) / rsp))
        for x, y, _ in g:
            d = [abs(x - cx) for cx in centers]
            ci = int(np.argmin(d))
            if d[ci] < sp * 0.35:
                obs.append((ri, ci, x, y))

    # ajuste afim (linha, coluna) -> (x, y), com descarte de pontos fora do padrão
    obs = np.array(obs, float)
    for _ in range(3):
        A = np.c_[np.ones(len(obs)), obs[:, 1], obs[:, 0]]
        cx, *_ = np.linalg.lstsq(A, obs[:, 2], rcond=None)
        cy, *_ = np.linalg.lstsq(A, obs[:, 3], rcond=None)
        res = np.hypot(A @ cx - obs[:, 2], A @ cy - obs[:, 3])
        keep = res < max(0.4 * rmed, np.percentile(res, 90))
        if keep.all():
            break
        obs = obs[keep]
    # o professor já informou quantas questões há: escolhe as n_q linhas seguidas com mais evidência
    counts = np.bincount(obs[:, 0].astype(int), minlength=n_q)
    s0 = max(range(len(counts) - n_q + 1), key=lambda k: counts[k:k + n_q].sum())
    block = range(s0, s0 + n_q)
    rows = []
    for ri in block:
        rows.append([(cx @ [1, ci, ri], cy @ [1, ci, ri], rmed) for ci in range(5)])
    return rows, rmed


def fill_ratio(gray, x, y, r):
    m = np.zeros_like(gray)
    cv2.circle(m, (int(x), int(y)), max(2, int(r * 0.6)), 255, -1)
    vals = gray[m > 0].astype(float)
    return float(255 - np.mean(vals)) / 255


def read_sheet(path, dbg_path, n_q):
    img = cv2.imread(path)
    s = TARGET_W / img.shape[1]
    img = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    gray = student_ink_gray(img)
    rows, rmed = group_rows(find_circles(gray), n_q)
    # remove sombra/iluminação desigual: escuro relativo ao papel em volta.
    # A mediana larga (61 px) roda numa cópia a 1/4 do tamanho (15 px), que
    # dá quase o mesmo fundo e é ~7x mais rápida.
    h, w = gray.shape
    small = cv2.resize(gray, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
    bg = cv2.resize(cv2.medianBlur(small, 15), (w, h), interpolation=cv2.INTER_LINEAR).astype(float) + 1
    norm = np.clip(gray / bg * 255, 0, 255).astype(np.uint8)
    dbg = img.copy()
    result = []
    for qi, row in enumerate(rows, 1):
        f = np.array([fill_ratio(norm, *c) for c in row])
        order = f.argsort()[::-1]
        top, second, base = f[order[0]], f[order[1]], np.median(f)
        gap = top - base
        if gap < 0.15:
            ans = "?"          # em branco ou incerto: professor confirma
        elif second - base > 0.6 * gap:
            ans = "*"          # duas marcadas
        else:
            ans = "ABCDE"[order[0]]
        result.append((qi, ans, [round(v, 2) for v in f]))
        for k, (x, y, r) in enumerate(row):
            on = ans not in "?*" and k == order[0]
            cv2.circle(dbg, (int(x), int(y)), int(r) + 4, (0, 200, 0) if on else (255, 120, 0), 3 if on else 1)
        cv2.putText(dbg, f"{qi}:{ans}", (int(row[0][0] - 9 * rmed), int(row[0][1] + rmed / 2)),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
    cv2.imwrite(dbg_path, dbg)
    return result


if __name__ == "__main__":
    # uso: python poc_bolhas.py <n_questoes> foto1.jpg [foto2.jpg ...]
    here = os.path.dirname(os.path.abspath(__file__))
    n_q = int(sys.argv[1])
    for i, p in enumerate(sys.argv[2:]):
        res = read_sheet(p, os.path.join(here, f"bolhas_{i}.png"), n_q)
        print("==", os.path.basename(p), "|", len(res), "questões")
        print("   respostas:", "".join(a for _, a, _ in res))
        for q in res:
            print("  ", q)
