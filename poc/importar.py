"""Acrescenta no dataset/respostas.csv as folhas de uma lista mandada pelo
grupo (dataset/LEIAME.md, "Jeito 1"). Cada linha da lista:

    LV-01: BABCDACC - caneta azul, luz boa
    LV-02: A_BCD*CC - lápis, sombra

O código da folha vira o nome do arquivo (lv-01.jpg, em dataset/fotos/); o
número de questões é o tamanho da resposta; as condições são padronizadas
para os nomes que o avaliar.py agrupa.

Uso:
    python poc/importar.py lista.txt --celular "Galaxy A32"
    python poc/importar.py lista.txt --celular "iPhone 11" --testar   # não grava
"""
import argparse
import csv
import os
import re
import sys
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
EXTENSOES = ('.jpg', '.jpeg', '.png')

# Nomes padronizados (dataset/LEIAME.md) e os jeitos comuns de escrevê-los.
CONDICOES = {
    'caneta azul': ['azul'],
    'caneta preta': ['preta', 'caneta preto', 'preto'],
    'lapis': ['grafite'],
    'forte': ['marcacao forte'],
    'fraca': ['marcacao fraca', 'fraco', 'leve'],
    'rabiscada': ['rabisco', 'rabiscado', 'rasura', 'rasurada'],
    'borracha': ['apagada', 'apagado', 'apagou'],
    'em branco': ['branco', 'branca', 'questao em branco'],
    'dupla': ['duas marcadas', 'duas', 'dupla marcacao'],
    'luz boa': ['boa luz', 'luz normal'],
    'sombra': ['com sombra'],
    'luz amarela': ['amarela', 'lampada amarela'],
    'perto': ['de perto'],
    'longe': ['de longe'],
    'torta': ['inclinada', 'torto', 'inclinado'],
}
SINONIMOS = {s: nome for nome, lista in CONDICOES.items() for s in [nome, *lista]}

LINHA = re.compile(r'^\s*([A-Za-z]{1,5}\s*-?\s*\d{1,3})\s*[:=]\s*([A-Ea-e_*?]+)\s*(?:[-–—]\s*(.*))?$')


def sem_acento(texto):
    return ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')


def condicao(texto):
    """Nome padronizado da condição, ou o próprio texto se não conhecer."""
    t = re.sub(r'\s+', ' ', sem_acento(texto).lower()).strip(' .')
    return SINONIMOS.get(t, t)


def achar_foto(pasta, codigo):
    """Arquivo da folha em dataset/fotos/, aceitando .jpg, .jpeg ou .png."""
    for ext in EXTENSOES:
        if os.path.isfile(os.path.join(pasta, codigo + ext)):
            return codigo + ext
    return None


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('lista', help='arquivo de texto com uma folha por linha')
    ap.add_argument('--celular', required=True, help='modelo do celular que tirou as fotos')
    ap.add_argument('--csv', default=os.path.join(RAIZ, 'dataset', 'respostas.csv'))
    ap.add_argument('--fotos', default=os.path.join(RAIZ, 'dataset', 'fotos'))
    ap.add_argument('--testar', action='store_true', help='só mostra o que seria gravado')
    args = ap.parse_args()

    with open(args.csv, newline='', encoding='utf-8-sig') as f:
        ja_no_csv = {(l.get('arquivo') or '').strip() for l in csv.DictReader(f)}

    novas, avisos = [], []
    with open(args.lista, encoding='utf-8-sig') as f:
        for i, texto in enumerate(f, 1):
            if not texto.strip():
                continue
            m = LINHA.match(texto)
            if not m:
                avisos.append(f'linha {i}: não entendi "{texto.strip()}" (esperado: LV-01: BABCDACC - caneta azul, luz boa)')
                continue
            codigo = re.sub(r'\s', '', m.group(1)).lower()
            if '-' not in codigo:
                codigo = re.sub(r'^([a-z]+)', r'\1-', codigo)
            respostas = m.group(2).upper()
            if '?' in respostas:
                avisos.append(f'linha {i} ({codigo}): "?" virou "_" (em branco); confira se era isso')
                respostas = respostas.replace('?', '_')
            conds = [condicao(c) for c in re.split(r'[,;]', m.group(3) or '') if c.strip()]
            for c in conds:
                if c not in CONDICOES:
                    avisos.append(f'linha {i} ({codigo}): condição "{c}" fora da lista padrão; mantida como está')
            arquivo = achar_foto(args.fotos, codigo)
            if arquivo is None:
                heic = os.path.isfile(os.path.join(args.fotos, codigo + '.heic'))
                dica = ' (está em HEIC: converta para JPG)' if heic else ''
                avisos.append(f'linha {i}: foto {codigo}.jpg não está em {args.fotos}{dica}; a linha entra assim mesmo')
                arquivo = codigo + '.jpg'
            if arquivo in ja_no_csv:
                avisos.append(f'linha {i}: {arquivo} já está no CSV; ignorada')
                continue
            ja_no_csv.add(arquivo)
            novas.append([arquivo, len(respostas), respostas, args.celular, '; '.join(conds)])

    for a in avisos:
        print('AVISO:', a)
    for n in novas:
        print(','.join(map(str, n)))
    if args.testar or not novas:
        print(f'\n{len(novas)} folha(s) {"seriam acrescentadas" if args.testar else "para acrescentar"}.')
        return 0
    with open(args.csv, 'rb') as f:
        conteudo = f.read()
    with open(args.csv, 'a', newline='', encoding='utf-8') as f:
        if conteudo and not conteudo.endswith(b'\n'):
            f.write('\n')
        csv.writer(f, lineterminator='\n').writerows(novas)
    print(f'\n{len(novas)} folha(s) acrescentada(s) em {args.csv}.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
