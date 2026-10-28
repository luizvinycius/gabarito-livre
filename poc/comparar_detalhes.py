"""Compara os valores intermediários da leitura do protótipo e do app
(avaliar.py --detalhes e npm run avaliar -- --detalhes): pontuação de anel e
bolinhas detectadas de cada linha e a posição de cada bolinha da grade.

As letras lidas podem continuar iguais mesmo com as duas implementações
começando a divergir; isto pega a diferença antes, enquanto ela ainda é
pequena. A tolerância cobre só o arredondamento de ponto flutuante (as
equações normais resolvidas pelo LAPACK no Python e à mão no app).

Uso:
    python poc/comparar_detalhes.py py.jsonl ts.jsonl

Sai com código 1 se alguma folha divergir.
"""
import json
import sys

TOL_ANEL = 1e-6   # pontuação de anel (0 a 5)
TOL_PX = 1e-4     # posição e raio da bolinha, em pixels


def ler(caminho):
    with open(caminho, encoding='utf-8') as f:
        return {d['arquivo']: d for d in (json.loads(linha) for linha in f if linha.strip())}


def diferencas(a, b):
    """Diferenças entre os detalhes de uma folha nas duas implementações."""
    if a['detectadas'] != b['detectadas']:
        return [f'detectadas {a["detectadas"]} x {b["detectadas"]}']
    if len(a['aneis']) != len(b['aneis']) or len(a['grade']) != len(b['grade']):
        return ['número de linhas diferente']
    erros = []
    da = max((abs(x - y) for x, y in zip(a['aneis'], b['aneis'])), default=0)
    if da > TOL_ANEL:
        erros.append(f'anel difere em até {da:.2e}')
    dp = max((abs(u - v) for la, lb in zip(a['grade'], b['grade'])
              for ca, cb in zip(la, lb) for u, v in zip(ca, cb)), default=0)
    if dp > TOL_PX:
        erros.append(f'grade difere em até {dp:.2e} px')
    return erros


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    py, ts = ler(sys.argv[1]), ler(sys.argv[2])
    problemas = [f'{arq}: só em um dos arquivos' for arq in sorted(set(py) ^ set(ts))]
    for arq in sorted(set(py) & set(ts)):
        problemas += [f'{arq}: {e}' for e in diferencas(py[arq], ts[arq])]
    for p in problemas:
        print(p)
    print(f'{len(set(py) & set(ts))} folhas comparadas, {len(problemas)} divergência(s).')
    return 1 if problemas else 0


if __name__ == '__main__':
    sys.exit(main())
