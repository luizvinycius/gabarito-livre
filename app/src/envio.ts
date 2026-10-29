// Envio das capturas da página de teste para um repositório PRIVADO do
// GitHub (gabarito-livre-capturas), pela API de conteúdo: cada arquivo vira
// um commit. O token fica só no navegador deste celular. Antes de enviar,
// confere que o repositório é privado: uma captura pode ter prova real com
// nome de aluno, e o repositório do app é público.

// apelido: nome curto deste aparelho (ex.: iphone-11), no nome da pasta de
// cada captura; vários celulares podem usar o mesmo token
export type ConfigEnvio = { repo: string; token: string; apelido: string }
export type ArquivoEnvio = { caminho: string; bytes: Uint8Array }

export const REPO_PADRAO = 'luizvinycius/gabarito-livre-capturas'
const CHAVE = 'gabarito-livre:envio'
const API = 'https://api.github.com'

export function configSalva(): ConfigEnvio {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) ?? '{}')
    return {
      repo: typeof c.repo === 'string' && c.repo ? c.repo : REPO_PADRAO,
      token: c.token ?? '',
      apelido: c.apelido ?? '',
    }
  } catch {
    return { repo: REPO_PADRAO, token: '', apelido: '' }
  }
}

// Apelido só com letras minúsculas sem acento, números e hífens (vai no nome
// da pasta): "iPhone 11 do Luiz" -> "iphone-11-do-luiz".
export function limparApelido(apelido: string): string {
  return apelido
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/, '')
}

// Palpite pelo navegador, quando o aparelho não tem apelido. O navegador não
// diz o modelo: o Safari do iPhone diz só "iPhone", e o Chrome do Android
// esconde o modelo.
export function apelidoPadrao(navegador: string): string {
  if (/iPhone/.test(navegador)) return 'iphone'
  if (/iPad/.test(navegador)) return 'ipad'
  if (/Android/.test(navegador)) return 'android'
  return 'pc'
}

export function salvarConfig(c: ConfigEnvio) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(c))
  } catch {
    // aba anônima: vale só até fechar a página
  }
}

// Pasta de uma captura: capturas/AAAA-MM-DD/HHMMSS-<n>q-<apelido> (hora
// local). O apelido separa as capturas de celulares diferentes no mesmo
// segundo.
export function pastaDaCaptura(quando: Date, nQuestoes: number, apelido: string): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const dia = `${quando.getFullYear()}-${p(quando.getMonth() + 1)}-${p(quando.getDate())}`
  const hora = `${p(quando.getHours())}${p(quando.getMinutes())}${p(quando.getSeconds())}`
  const nome = limparApelido(apelido)
  return `capturas/${dia}/${hora}-${nQuestoes}q${nome ? `-${nome}` : ''}`
}

export function paraBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function textoEmBytes(texto: string): Uint8Array {
  return new TextEncoder().encode(texto)
}

function cabecalhos(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

// Mensagem em português para as respostas de erro mais comuns da API.
async function erroDaApi(r: Response, oQue: string): Promise<Error> {
  let detalhe = ''
  try {
    detalhe = (await r.json()).message ?? ''
  } catch {
    // sem corpo
  }
  const motivo =
    r.status === 401
      ? 'token inválido ou expirado'
      : r.status === 403
        ? 'o token não tem permissão de escrita (Contents: Read and write) neste repositório'
        : r.status === 404
          ? 'repositório não encontrado, ou o token não tem acesso a ele'
          : r.status === 422
            ? 'já existe um arquivo com esse nome'
            : `erro ${r.status}`
  return new Error(`${oQue}: ${motivo}${detalhe ? ` (${detalhe})` : ''}`)
}

/**
 * Confere o repositório: existe, o token alcança, dá para gravar e é
 * privado. Devolve o nome completo dele. Lança um erro com o motivo.
 */
export async function conferirRepositorio(
  { repo, token }: Pick<ConfigEnvio, 'repo' | 'token'>,
  buscar: typeof fetch = fetch,
) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repositório deve ser "dono/nome"')
  if (!token) throw new Error('Falta o token')
  let r: Response
  try {
    r = await buscar(`${API}/repos/${repo}`, { headers: cabecalhos(token) })
  } catch {
    throw new Error('Sem conexão com o GitHub')
  }
  if (!r.ok) throw await erroDaApi(r, 'Não consegui abrir o repositório')
  const info = await r.json()
  if (!info.private)
    throw new Error(
      `O repositório ${info.full_name} é público: as capturas podem ter prova real com nome de aluno. Use um repositório privado.`,
    )
  if (info.permissions && !info.permissions.push)
    throw new Error('O token não tem permissão de escrita (Contents: Read and write) neste repositório')
  return info.full_name as string
}

/**
 * Envia os arquivos (um commit cada) depois de conferir o repositório.
 * Devolve o endereço da pasta no GitHub.
 */
export async function enviarArquivos(
  config: ConfigEnvio,
  pasta: string,
  arquivos: ArquivoEnvio[],
  mensagem: string,
  buscar: typeof fetch = fetch,
): Promise<string> {
  const repo = await conferirRepositorio(config, buscar)
  for (const { caminho, bytes } of arquivos) {
    const url = `${API}/repos/${repo}/contents/${[...pasta.split('/'), caminho].map(encodeURIComponent).join('/')}`
    let r: Response
    try {
      r = await buscar(url, {
        method: 'PUT',
        headers: cabecalhos(config.token),
        body: JSON.stringify({ message: mensagem, content: paraBase64(bytes) }),
      })
    } catch {
      throw new Error(`Sem conexão com o GitHub ao enviar ${caminho}`)
    }
    if (!r.ok) throw await erroDaApi(r, `Não consegui enviar ${caminho}`)
  }
  return `https://github.com/${repo}/tree/main/${pasta}`
}
