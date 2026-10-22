// Foto de cada folha corrigida, guardada no IndexedDB do aparelho para o
// professor conferir a leitura depois (o localStorage não tem espaço para
// isso). Se o navegador não deixar guardar, o app funciona igual, só sem a
// foto na hora de rever a folha.

const BANCO = 'gabarito-livre'
const LOJA = 'fotos'

let banco: Promise<IDBDatabase> | null = null

function abrir(): Promise<IDBDatabase> {
  banco ??= new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(BANCO, 1)
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA)
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => rejeitar(pedido.error)
  })
  banco.catch(() => (banco = null))
  return banco
}

async function operar<T>(modo: IDBTransactionMode, f: (loja: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await abrir()
  return new Promise((resolver, rejeitar) => {
    const t = db.transaction(LOJA, modo)
    const pedido = f(t.objectStore(LOJA))
    t.oncomplete = () => resolver(pedido ? pedido.result : undefined)
    t.onerror = () => rejeitar(t.error)
    t.onabort = () => rejeitar(t.error)
  })
}

// Guarda a imagem reduzida (a leitura é desenhada por cima nesse tamanho).
export async function guardarFoto(id: string, fonte: CanvasImageSource & { width: number; height: number }, largura: number) {
  try {
    const c = document.createElement('canvas')
    c.width = Math.min(largura, fonte.width)
    c.height = Math.round((fonte.height * c.width) / fonte.width)
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(fonte, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.75))
    if (blob) await operar('readwrite', (loja) => loja.put(blob, id))
  } catch {
    // sem IndexedDB ou sem espaço: a folha fica sem foto
  }
}

export async function lerFoto(id: string): Promise<ImageBitmap | null> {
  try {
    const blob = await operar<Blob>('readonly', (loja) => loja.get(id))
    return blob ? await createImageBitmap(blob) : null
  } catch {
    return null
  }
}

export async function apagarFotos(ids?: string[]) {
  try {
    await operar('readwrite', (loja) => {
      if (!ids) loja.clear()
      else for (const id of ids) loja.delete(id)
    })
  } catch {
    // nada a fazer
  }
}
