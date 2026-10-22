"""Mede a precisão da leitura no conjunto de teste (seção 8.3 da documentação).

Lê dataset/respostas.csv, roda o algoritmo do poc_bolhas.py em cada foto de
dataset/fotos/ e compara com as respostas anotadas. A métrica mais importante
é o ERRO SILENCIOSO: o app mostrar uma letra errada sem avisar.

Uso:
    python poc/avaliar.py
    python poc/avaliar.py --depurar          # salva as imagens das folhas com problema
    python poc/avaliar.py --csv outro.csv --fotos outra/pasta
    python poc/avaliar.py --conjunto sinteticas   # dataset/sinteticas/ (gerar_sinteticas.py)
    python poc/avaliar.py --leituras py.csv       # grava "arquivo;lido" de cada folha

Formato do CSV:
    arquivo,n_questoes,respostas,celular,condicao
    ana_01.jpg,8,BABCDACC,iPhone 12,caneta azul; luz boa
    recorte-8q-20261018-215723.jpg,8,A_BCD*CC,Moto G,lapis; Q2 em branco; Q6 dupla
  respostas: uma letra por questão; _ = em branco, * = duas marcadas,
  ? = o app tem de pedir confirmação (tabela cortada, linhas a mais).
  Arquivos que começam com "recorte-" foram salvos pelo app (só a tabela) e
  são lidos a 800 px, como no app; os demais são a folha inteira (1000 px).

Sai com código 1 se houver algum erro silencioso.
"""
import argparse
import csv
import os
import sys
import time
from collections import defaultdict

import cv2

import poc_bolhas

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
LARGURA_FOLHA = 1000
LARGURA_RECORTE = 800


def classificar(esperada, lida):
    """Classifica uma questão:
    'certa'      -> leu o esperado (em branco esperado e lido '?' também conta);
    'aviso'      -> o app pediu confirmação ('?' ou '*') ou não achou a
                    tabela ('-'), e o professor corrige;
    'silenciosa' -> o app mostrou uma letra errada sem avisar."""
    if esperada == '?':
        return 'silenciosa' if lida in 'ABCDE' else 'certa'
    if esperada == '_':
        return 'certa' if lida == '?' else 'silenciosa' if lida in 'ABCDE' else 'aviso'
    if esperada == '*':
        return 'certa' if lida == '*' else 'silenciosa' if lida in 'ABCDE' else 'aviso'
    if lida == esperada:
        return 'certa'
    return 'aviso' if lida in '?*-' else 'silenciosa'


def ler_csv(caminho):
    linhas, problemas = [], []
    with open(caminho, newline='', encoding='utf-8-sig') as f:
        for i, linha in enumerate(csv.DictReader(f), start=2):
            arquivo = (linha.get('arquivo') or '').strip()
            if not arquivo:
                continue
            try:
                n = int(linha['n_questoes'])
            except (KeyError, TypeError, ValueError):
                problemas.append(f'linha {i}: n_questoes inválido')
                continue
            resp = (linha.get('respostas') or '').strip().upper()
            if len(resp) != n or any(c not in 'ABCDE_*?' for c in resp):
                problemas.append(f'linha {i} ({arquivo}): respostas "{resp}" não batem com {n} questões A-E/_/*/?')
                continue
            condicoes = [c.strip().lower() for c in (linha.get('condicao') or '').split(';') if c.strip()]
            linhas.append({
                'arquivo': arquivo, 'n': n, 'respostas': resp,
                'celular': (linha.get('celular') or '').strip() or '(não informado)',
                'condicoes': condicoes,
            })
    return linhas, problemas


def porcentagem(parte, todo):
    return f'{100 * parte / todo:5.1f}%' if todo else '   - '


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--conjunto', metavar='NOME',
                    help='pasta dentro de dataset/ com respostas.csv e fotos/ (ex.: sinteticas)')
    ap.add_argument('--csv')
    ap.add_argument('--fotos')
    ap.add_argument('--leituras', metavar='ARQUIVO',
                    help='grava "arquivo;lido" de cada folha (para comparar com o npm run avaliar)')
    ap.add_argument('--depurar', nargs='?', const=os.path.join(AQUI, 'saida'), metavar='PASTA',
                    help='salva a imagem de depuração das folhas com aviso ou erro (padrão: poc/saida/)')
    args = ap.parse_args()
    pasta = os.path.join(RAIZ, 'dataset', args.conjunto) if args.conjunto else os.path.join(RAIZ, 'dataset')
    args.csv = args.csv or os.path.join(pasta, 'respostas.csv')
    args.fotos = args.fotos or os.path.join(pasta, 'fotos')

    folhas, problemas = ler_csv(args.csv)
    for p in problemas:
        print('AVISO no CSV:', p)
    if not folhas:
        print(f'Nenhuma folha em {args.csv}. Preencha o CSV conforme a seção 8.3 da documentação.')
        return 0
    if args.depurar:
        os.makedirs(args.depurar, exist_ok=True)

    total = defaultdict(int)                       # contagem geral por classe
    por_grupo = defaultdict(lambda: defaultdict(int))  # 'celular: X' / 'condição: Y' -> classes
    silenciosas, faltando, tempos, leituras = [], [], [], []
    folhas_certas = folhas_lidas = 0

    print(f'{"arquivo":40s} {"esperado":12s} {"lido":12s} resultado')
    for folha in folhas:
        caminho = os.path.join(args.fotos, folha['arquivo'])
        img = cv2.imread(caminho) if os.path.isfile(caminho) else None
        if img is None:
            faltando.append(folha['arquivo'])
            continue
        largura = LARGURA_RECORTE if folha['arquivo'].startswith('recorte-') else LARGURA_FOLHA
        t0 = time.perf_counter()
        resultado, dbg = poc_bolhas.read_image(img, folha['n'], largura)
        tempos.append(time.perf_counter() - t0)
        folhas_lidas += 1

        lido = ''.join(a for _, a, _ in resultado) or '-' * folha['n']  # '-': tabela não encontrada
        leituras.append(f'{folha["arquivo"]};{lido}')
        classes = [classificar(e, l) for e, l in zip(folha['respostas'], lido)]
        grupos = [f'celular: {folha["celular"]}'] + [f'condição: {c}' for c in folha['condicoes']]
        for qi, c in enumerate(classes, 1):
            total[c] += 1
            for g in grupos:
                por_grupo[g][c] += 1
            if c == 'silenciosa':
                silenciosas.append(f'{folha["arquivo"]} Q{qi}: esperado {folha["respostas"][qi - 1]}, lido {lido[qi - 1]}')

        if all(c == 'certa' for c in classes):
            folhas_certas += 1
            situacao = 'ok'
        else:
            n_sil = classes.count('silenciosa')
            n_av = classes.count('aviso')
            situacao = ', '.join(p for p in [
                f'{n_sil} ERRADA(S) SEM AVISO' if n_sil else '',
                f'{n_av} com aviso' if n_av else '',
                'tabela não encontrada' if not resultado else '',
            ] if p)
            if args.depurar:
                cv2.imwrite(os.path.join(args.depurar, os.path.splitext(folha['arquivo'])[0] + '.png'), dbg)
        print(f'{folha["arquivo"][:40]:40s} {folha["respostas"]:12s} {lido:12s} {situacao}')

    if args.leituras:
        with open(args.leituras, 'w', encoding='utf-8', newline='\n') as f:
            f.write('\n'.join(leituras) + '\n')
    questoes = sum(total.values())
    print()
    print(f'Folhas lidas: {folhas_lidas} ({folhas_certas} totalmente certas)')
    if faltando:
        print(f'Fotos não encontradas em {args.fotos}: {", ".join(faltando)}')
    if questoes:
        print(f'Questões: {questoes}')
        print(f'  certas ............ {total["certa"]:4d}  {porcentagem(total["certa"], questoes)}   (meta: >= 99%)')
        print(f'  com aviso (? ou *)  {total["aviso"]:4d}  {porcentagem(total["aviso"], questoes)}')
        print(f'  ERRO SILENCIOSO ... {total["silenciosa"]:4d}  {porcentagem(total["silenciosa"], questoes)}   (meta: o mais perto possível de 0)')
        print(f'Tempo médio por folha (Python, neste PC): {1000 * sum(tempos) / len(tempos):.0f} ms')

        print()
        print(f'{"por celular / condição":40s} {"questões":>8s} {"certas":>7s} {"aviso":>7s} {"silenc.":>7s}')
        for g in sorted(por_grupo):
            c = por_grupo[g]
            n = sum(c.values())
            print(f'{g[:40]:40s} {n:8d} {porcentagem(c["certa"], n):>7s} {porcentagem(c["aviso"], n):>7s} {c["silenciosa"]:7d}')

    if silenciosas:
        print()
        print('Erros silenciosos (prioridade máxima):')
        for s in silenciosas:
            print('  ', s)
    if args.depurar and folhas_lidas > folhas_certas:
        print()
        print(f'Imagens de depuração das folhas com problema em: {args.depurar}')
    return 1 if silenciosas else 0


if __name__ == '__main__':
    sys.exit(main())
