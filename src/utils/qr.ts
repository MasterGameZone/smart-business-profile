export function svgContainerToBlob(container: HTMLElement | null): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svg = container?.querySelector('svg')
    if (!svg) { reject(new Error('SVG not found')); return }
    const size = 400
    const serialised = new XMLSerializer().serializeToString(svg)
    const svgUrl = URL.createObjectURL(
      new Blob([serialised], { type: 'image/svg+xml;charset=utf-8' })
    )
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(svgUrl); reject(new Error('No canvas context')); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      URL.revokeObjectURL(svgUrl)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('toBlob failed'))
      }, 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error('Image load error')) }
    img.src = svgUrl
  })
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
