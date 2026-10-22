// Entrega um arquivo ao professor: no celular, abre o compartilhamento do
// sistema (no iPhone dá para "Salvar em Arquivos", mandar no WhatsApp...);
// no computador, ou onde não houver, baixa o arquivo.

export async function entregarArquivo(arquivo: File): Promise<void> {
  const celular = matchMedia('(pointer: coarse)').matches
  if (celular && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo] })
    } catch (err) {
      // cancelar o compartilhamento não é erro
      if (!(err instanceof DOMException && err.name === 'AbortError')) throw err
    }
    return
  }
  const url = URL.createObjectURL(arquivo)
  const a = document.createElement('a')
  a.href = url
  a.download = arquivo.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
