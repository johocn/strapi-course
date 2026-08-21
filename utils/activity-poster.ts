/**
 * 活动分享海报绘制（纯函数，不耦合 uni 生命周期）
 * 依赖 UQRCode 生成二维码，canvas 2D 绘制布局。
 */
import UQRCode from 'uqrcodejs'

const DESIGN_W = 750
const DESIGN_H = 1200
const GRAD_START = '#667eea'
const GRAD_END = '#764ba2'

export interface PosterActivity {
  title: string
  startTime?: string
  endTime?: string
  venueName?: string
  tailText?: string
}

export function qrcodeDataURL(text: string, size = 320, color = '#000000', bg = '#ffffff'): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const qr = new UQRCode()
  qr.data = text
  qr.size = size
  qr.make()

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  const drawModules = qr.getDrawModules() as Array<{
    type: string
    x: number
    y: number
    width: number
    height: number
    color?: string
  }>
  for (let i = 0; i < drawModules.length; i++) {
    const m = drawModules[i]
    if (m.type === 'tile') {
      ctx.fillStyle = m.color ?? color
      ctx.fillRect(m.x, m.y, m.width, m.height)
    }
  }
  return canvas.toDataURL('image/png')
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

export function drawActivityPoster(
  canvas: HTMLCanvasElement,
  activity: PosterActivity,
  shareUrl: string
): void {
  const W = canvas.width
  const H = canvas.height
  const scale = W / DESIGN_W
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const x = (v: number) => v * scale
  const y = (v: number) => v * scale
  const fs = (px: number) => px * scale

  ctx.clearRect(0, 0, W, H)

  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, GRAD_START)
  grad.addColorStop(1, GRAD_END)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = `bold ${fs(28)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('胜林在线 · 线下活动', W / 2, y(70))

  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${fs(46)}px sans-serif`
  const title = activity.title || '线下活动'
  const maxWidth = DESIGN_W - 120
  const lines = wrapText(ctx, title, x(maxWidth))
  for (let i = 0; i < lines.length && i < 2; i++) {
    ctx.fillText(lines[i], W / 2, y(220) + i * fs(60))
  }

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = `${fs(32)}px sans-serif`
  const timeText = formatTime(activity.startTime) && activity.startTime === activity.endTime
    ? formatTime(activity.startTime)
    : `${formatTime(activity.startTime)} ~ ${formatTime(activity.endTime)}`
  ctx.fillText(timeText, W / 2, y(360))

  if (activity.venueName) {
    ctx.fillText(activity.venueName || '待定场地', W / 2, y(420))
  }

  const qrSize = 400
  const qrX = (DESIGN_W - qrSize) / 2
  const qrY = 480
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, x(qrX), y(qrY), x(qrSize), x(qrSize), x(24))
  ctx.fill()
  const qrImg = qrcodeDataURL(shareUrl, 400)
  if (qrImg) {
    const img = new Image()
    img.onload = () => {
      const pad = 30
      ctx.drawImage(img, x(qrX + pad), y(qrY + pad), x(qrSize - pad * 2), x(qrSize - pad * 2))
    }
    img.src = qrImg
  }

  const tail = activity.tailText || '扫码报名，一起参加！'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `${fs(30)}px sans-serif`
  ctx.fillText(tail, W / 2, y(1060))
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = Array.from(text)
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < chars.length; i++) {
    if (ctx.measureText(line + chars[i]).width > maxWidth) {
      lines.push(line)
      line = chars[i]
    } else {
      line += chars[i]
    }
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x0 + r, y0)
  ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r)
  ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r)
  ctx.arcTo(x0, y0 + h, x0, y0, r)
  ctx.arcTo(x0, y0, x0 + w, y0, r)
  ctx.closePath()
}