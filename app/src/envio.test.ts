import { describe, expect, it } from 'vitest'
import {
  apelidoPadrao,
  conferirRepositorio,
  enviarArquivos,
  limparApelido,
  paraBase64,
  pastaDaCaptura,
  textoEmBytes,
} from './envio'

const config = { repo: 'grupo/capturas', token: 'tk', apelido: '' }

// fetch falso: responde com os corpos dados, na ordem, e guarda as chamadas
function falso(...respostas: { status?: number; corpo?: unknown }[]) {
  const chamadas: { url: string; init?: RequestInit }[] = []
  const buscar = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, init })
    const { status = 200, corpo = {} } = respostas.shift() ?? {}
    return new Response(JSON.stringify(corpo), { status })
  }) as typeof fetch
  return { buscar, chamadas }
}

const privado = { corpo: { full_name: 'grupo/capturas', private: true, permissions: { push: true } } }

describe('pastaDaCaptura', () => {
  it('usa a data e a hora locais, o número de questões e o apelido do aparelho', () => {
    const quando = new Date(2026, 9, 29, 16, 4, 7)
    expect(pastaDaCaptura(quando, 8, 'iphone-11')).toBe('capturas/2026-10-29/160407-8q-iphone-11')
    expect(pastaDaCaptura(quando, 8, '')).toBe('capturas/2026-10-29/160407-8q')
  })
})

describe('limparApelido', () => {
  it('deixa só minúsculas sem acento, números e hífens', () => {
    expect(limparApelido('  iPhone 11 do Luíz! ')).toBe('iphone-11-do-luiz')
    expect(limparApelido('Galaxy A32 / sala 3')).toBe('galaxy-a32-sala-3')
    expect(limparApelido('../../main')).toBe('main')
    expect(limparApelido('um apelido grande demais para pasta')).toBe('um-apelido-grande-demais')
  })
})

describe('apelidoPadrao', () => {
  it('dá um palpite pelo navegador', () => {
    expect(apelidoPadrao('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('iphone')
    expect(apelidoPadrao('Mozilla/5.0 (Linux; Android 10; K) Chrome/141.0')).toBe('android')
    expect(apelidoPadrao('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('pc')
  })
})

describe('paraBase64', () => {
  it('codifica bytes, inclusive acentos e arquivos grandes', () => {
    expect(paraBase64(textoEmBytes('Questão'))).toBe(btoa(unescape(encodeURIComponent('Questão'))))
    const grande = new Uint8Array(100_000).map((_, i) => i % 256)
    expect(atob(paraBase64(grande)).length).toBe(100_000)
  })
})

describe('conferirRepositorio', () => {
  it('aceita um repositório privado com permissão de escrita', async () => {
    const { buscar, chamadas } = falso(privado)
    expect(await conferirRepositorio(config, buscar)).toBe('grupo/capturas')
    expect(chamadas[0].url).toBe('https://api.github.com/repos/grupo/capturas')
    expect(new Headers(chamadas[0].init?.headers).get('Authorization')).toBe('Bearer tk')
  })

  it('recusa um repositório público', async () => {
    const { buscar } = falso({ corpo: { full_name: 'grupo/app', private: false, permissions: { push: true } } })
    await expect(conferirRepositorio(config, buscar)).rejects.toThrow(/público/)
  })

  it('explica o token sem permissão de escrita', async () => {
    const { buscar } = falso({ corpo: { full_name: 'grupo/capturas', private: true, permissions: { push: false } } })
    await expect(conferirRepositorio(config, buscar)).rejects.toThrow(/permissão de escrita/)
  })

  it('explica o token inválido e o repositório que não existe', async () => {
    await expect(conferirRepositorio(config, falso({ status: 401 }).buscar)).rejects.toThrow(/token inválido/)
    await expect(conferirRepositorio(config, falso({ status: 404 }).buscar)).rejects.toThrow(/não encontrado/)
  })

  it('não chama a API sem token ou com o nome do repositório errado', async () => {
    const { buscar, chamadas } = falso()
    await expect(conferirRepositorio({ repo: 'grupo/capturas', token: '' }, buscar)).rejects.toThrow(/token/)
    await expect(conferirRepositorio({ repo: 'capturas', token: 'tk' }, buscar)).rejects.toThrow(/dono\/nome/)
    expect(chamadas).toHaveLength(0)
  })
})

describe('enviarArquivos', () => {
  it('confere o repositório e grava cada arquivo na pasta da captura', async () => {
    const { buscar, chamadas } = falso(privado, {}, {})
    const url = await enviarArquivos(
      config,
      'capturas/2026-10-29/160407-8q',
      [
        { caminho: 'recorte.jpg', bytes: new Uint8Array([255, 216, 255]) },
        { caminho: 'dados.json', bytes: textoEmBytes('{"a":1}') },
      ],
      'captura 8q',
      buscar,
    )
    expect(url).toBe('https://github.com/grupo/capturas/tree/main/capturas/2026-10-29/160407-8q')
    expect(chamadas.map((c) => c.init?.method ?? 'GET')).toEqual(['GET', 'PUT', 'PUT'])
    expect(chamadas[1].url).toBe(
      'https://api.github.com/repos/grupo/capturas/contents/capturas/2026-10-29/160407-8q/recorte.jpg',
    )
    const corpo = JSON.parse(chamadas[2].init!.body as string)
    expect(corpo).toEqual({ message: 'captura 8q', content: btoa('{"a":1}') })
  })

  it('não envia nada para um repositório público', async () => {
    const { buscar, chamadas } = falso({ corpo: { full_name: 'grupo/app', private: false } })
    await expect(
      enviarArquivos(config, 'capturas/x', [{ caminho: 'a.json', bytes: textoEmBytes('{}') }], 'm', buscar),
    ).rejects.toThrow(/público/)
    expect(chamadas).toHaveLength(1)
  })

  it('diz qual arquivo falhou', async () => {
    const { buscar } = falso(privado, { status: 422, corpo: { message: 'sha wasn\'t supplied' } })
    await expect(
      enviarArquivos(config, 'capturas/x', [{ caminho: 'recorte.jpg', bytes: new Uint8Array([1]) }], 'm', buscar),
    ).rejects.toThrow(/recorte\.jpg: já existe/)
  })
})
