const EXPORT_WIDTH = 1748
const EXPORT_HEIGHT = 2480
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Logo data could not be read.'))
      }
    }
    reader.onerror = () => reject(new Error('Logo data could not be read.'))
    reader.readAsDataURL(blob)
  })
}

function setImageHref(image: SVGImageElement, href: string): void {
  image.setAttribute('href', href)
  image.setAttributeNS(XLINK_NAMESPACE, 'xlink:href', href)
}

function useLogoFallback(svg: SVGSVGElement, image: SVGImageElement): void {
  image.setAttribute('opacity', '0')
  const fallback = svg.querySelector('[data-logo-fallback="true"]')
  fallback?.setAttribute('opacity', '1')
}

async function inlineLogoImages(svg: SVGSVGElement): Promise<void> {
  const images = Array.from(svg.querySelectorAll<SVGImageElement>('image[data-logo-image="true"]'))

  await Promise.all(
    images.map(async (image) => {
      const source = image.getAttribute('href') || image.getAttributeNS(XLINK_NAMESPACE, 'href')
      if (!source || source.startsWith('data:')) return

      try {
        const response = await fetch(source, { credentials: 'omit' })
        if (!response.ok) throw new Error(`Logo request failed with status ${response.status}.`)
        setImageHref(image, await blobToDataUrl(await response.blob()))
      } catch {
        useLogoFallback(svg, image)
      }
    })
  )
}

function serializePoster(svg: SVGSVGElement): string {
  try {
    const serialized = new XMLSerializer().serializeToString(svg)
    if (!serialized) throw new Error('The poster SVG is empty.')
    return serialized
  } catch {
    throw new Error('Unable to serialize the QR poster.')
  }
}

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to render the QR poster image.'))
    image.src = url
  })
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Unable to generate the QR poster PNG.'))
        }
      }, 'image/png')
    } catch {
      reject(new Error('Unable to generate the QR poster PNG.'))
    }
  })
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)

  try {
    anchor.click()
  } finally {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }
}

export async function downloadQrPosterPng(posterSvg: SVGSVGElement | null, filename: string): Promise<void> {
  if (!posterSvg) throw new Error('The QR poster is not available.')

  const clonedSvg = posterSvg.cloneNode(true) as SVGSVGElement
  clonedSvg.setAttribute('xmlns', SVG_NAMESPACE)
  clonedSvg.setAttribute('xmlns:xlink', XLINK_NAMESPACE)
  clonedSvg.setAttribute('width', String(EXPORT_WIDTH))
  clonedSvg.setAttribute('height', String(EXPORT_HEIGHT))
  clonedSvg.setAttribute('viewBox', '0 0 874 1240')
  clonedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  clonedSvg.removeAttribute('class')
  clonedSvg.setAttribute('style', 'display:block;width:100%;height:100%;background:#ffffff;')

  await inlineLogoImages(clonedSvg)

  const serializedSvg = serializePoster(clonedSvg)
  const svgUrl = URL.createObjectURL(new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const image = await loadSvgImage(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = EXPORT_WIDTH
    canvas.height = EXPORT_HEIGHT

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to create a canvas for the QR poster.')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
    try {
      context.drawImage(image, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT)
    } catch {
      throw new Error('Unable to render the QR poster on the canvas.')
    }

    downloadBlob(await canvasToPng(canvas), filename)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
