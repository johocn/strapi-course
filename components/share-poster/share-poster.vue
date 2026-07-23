<template>
  <view v-if="visible" class="poster-overlay" @click.self="close">
    <view class="poster-container">
      <view class="poster-header">
        <text class="poster-title">分享海报</text>
        <view class="poster-close" @click="close">×</view>
      </view>
      <scroll-view scroll-y class="poster-body">
        <view class="poster-preview">
          <canvas 
            #ifdef H5
            canvas-id="sharePosterCanvas"
            id="sharePosterCanvas"
            :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
            class="poster-canvas"
          />
          #endif
          <canvas 
            #ifndef H5
            canvas-id="sharePosterCanvas"
            :style="{ width: canvasWidth + 'rpx', height: canvasHeight + 'rpx' }"
            class="poster-canvas"
          />
          #endif
          <view v-if="!generated" class="poster-loading">
            <view class="loading-spinner" />
            <text class="loading-text">正在生成海报...</text>
          </view>
        </view>
      </scroll-view>
      <view class="poster-footer">
        <view class="save-btn" @click="savePoster">保存图片</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getInviteCode } from '@/utils/invite'
import { getUser } from '@/utils/storage'
import { BASE_URL, SITE_DOMAIN } from '@/utils/env'
import { getStoredAuthConfig } from '@/services/auth-config'

interface PosterConfig {
  title?: string
  desc?: string
  coverUrl?: string
  pagePath?: string
  customData?: Record<string, string>
}

const props = withDefaults(defineProps<{
  visible: boolean
  config?: PosterConfig
}>(), {
  visible: false,
  config: () => ({})
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const generated = ref(false)
const canvasWidth = ref(600)
const canvasHeight = ref(800)

const close = () => {
  emit('close')
}

const getShareUrl = (): string => {
  const inviteCode = getInviteCode()
  const userId = getUser()?.id ?? ''
  const pagePath = props.config?.pagePath ?? ''
  
  // #ifdef H5
  let url = `${window.location.origin}`
  if (pagePath) {
    url += '/#/' + pagePath.replace(/^\/?/, '')
  }
  const separator = url.includes('?') ? '&' : '?'
  const params: string[] = []
  if (inviteCode) params.push(`inviteCode=${inviteCode}`)
  if (userId) params.push(`inviterId=${userId}`)
  if (props.config?.customData) {
    Object.entries(props.config.customData).forEach(([k, v]) => {
      params.push(`${k}=${encodeURIComponent(v)}`)
    })
  }
  if (params.length > 0) url += `${separator}${params.join('&')}`
  return url
  // #endif
  
  // #ifndef H5
  let url = pagePath || '/pages/index/index'
  const separator = url.includes('?') ? '&' : '?'
  const params: string[] = []
  if (inviteCode) params.push(`inviteCode=${inviteCode}`)
  if (userId) params.push(`inviterId=${userId}`)
  if (props.config?.customData) {
    Object.entries(props.config.customData).forEach(([k, v]) => {
      params.push(`${k}=${encodeURIComponent(v)}`)
    })
  }
  if (params.length > 0) url += `${separator}${params.join('&')}`
  return url
  // #endif
}

const downloadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    resolve(url)
    // #endif
    // #ifndef H5
    uni.downloadFile({
      url: url.startsWith('http') ? url : `${BASE_URL}${url}`,
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.tempFilePath)
        } else {
          reject(new Error('下载图片失败'))
        }
      },
      fail: reject
    })
    // #endif
  })
}

const generateQRCode = (canvasCtx: any, x: number, y: number, size: number, isH5: boolean): Promise<void> => {
  return new Promise((resolve) => {
    const qrCodeUrl = getShareUrl()
    const qrcode = require('uqrcodejs') as any
    const qr = new qrcode.QRCode({
      width: size,
      height: size,
      typeNumber: 4,
      colorDark: '#000000',
      colorLight: '#ffffff',
    })
    qr.addData(qrCodeUrl)
    qr.make()
    const modules = qr.modules
    const moduleSize = size / modules.length
    
    if (isH5) {
      for (let row = 0; row < modules.length; row++) {
        for (let col = 0; col < modules[row].length; col++) {
          if (modules[row][col]) {
            canvasCtx.fillStyle = '#000000'
          } else {
            canvasCtx.fillStyle = '#ffffff'
          }
          canvasCtx.fillRect(x + col * moduleSize, y + row * moduleSize, moduleSize + 1, moduleSize + 1)
        }
      }
    } else {
      for (let row = 0; row < modules.length; row++) {
        for (let col = 0; col < modules[row].length; col++) {
          if (modules[row][col]) {
            canvasCtx.setFillStyle('#000000')
          } else {
            canvasCtx.setFillStyle('#ffffff')
          }
          canvasCtx.fillRect(x + col * moduleSize, y + row * moduleSize, moduleSize + 1, moduleSize + 1)
        }
      }
    }
    resolve()
  })
}

const drawPoster = async () => {
  generated.value = false
  
  // #ifdef H5
  const canvas = document.getElementById('sharePosterCanvas') as HTMLCanvasElement
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  canvas.width = canvasWidth.value
  canvas.height = canvasHeight.value
  
  const width = canvas.width
  const height = canvas.height
  
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  
  const padding = 30
  let y = padding
  
  const authConfig = getStoredAuthConfig()
  const logoUrl = authConfig?.logo?.url || `${BASE_URL}/static/logo.png`
  
  try {
    const logoPath = await downloadImage(logoUrl)
    const logoImg = new Image()
    logoImg.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve()
      logoImg.onerror = () => reject(new Error('加载logo失败'))
      logoImg.src = logoPath
    })
    
    const logoSize = 60
    ctx.drawImage(logoImg, width - padding - logoSize, y, logoSize, logoSize)
  } catch (e) {
    console.warn('[poster] 绘制logo失败:', e)
  }
  
  y += 80
  
  const title = props.config?.title ?? authConfig?.shareTitle ?? '学习课程，答题赢积分'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillStyle = '#333333'
  ctx.textAlign = 'center'
  ctx.fillText(title, width / 2, y)
  
  y += 40
  
  const desc = props.config?.desc ?? authConfig?.shareDescription ?? '快来一起学习吧！'
  ctx.font = '24px sans-serif'
  ctx.fillStyle = '#666666'
  ctx.fillText(desc, width / 2, y)
  
  y += 30
  
  const coverUrl = props.config?.coverUrl
  if (coverUrl) {
    try {
      const coverPath = await downloadImage(coverUrl)
      const coverImg = new Image()
      coverImg.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        coverImg.onload = () => resolve()
        coverImg.onerror = () => reject(new Error('加载封面失败'))
        coverImg.src = coverPath
      })
      
      const coverWidth = width - padding * 2
      const coverHeight = coverWidth * 0.6
      ctx.drawImage(coverImg, padding, y, coverWidth, coverHeight)
      y += coverHeight + 20
    } catch (e) {
      console.warn('[poster] 绘制封面失败:', e)
      y += 300 + 20
    }
  }
  
  y += 20
  
  const qrSize = 180
  const qrX = (width - qrSize) / 2
  await generateQRCode(ctx, qrX, y, qrSize, true)
  
  y += qrSize + 15
  
  ctx.font = '20px sans-serif'
  ctx.fillStyle = '#999999'
  ctx.fillText('扫码立即体验', width / 2, y)
  
  generated.value = true
  // #endif
  
  // #ifndef H5
  const ctx = uni.createCanvasContext('sharePosterCanvas')
  const width = 600
  const height = 800
  
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, width, height)
  
  const padding = 30
  let y = padding
  
  const authConfig = getStoredAuthConfig()
  const logoUrl = authConfig?.logo?.url || `${BASE_URL}/static/logo.png`
  
  try {
    const logoPath = await downloadImage(logoUrl)
    ctx.drawImage(logoPath, width - padding - 60, y, 60, 60)
  } catch (e) {
    console.warn('[poster] 绘制logo失败:', e)
  }
  
  y += 80
  
  const title = props.config?.title ?? authConfig?.shareTitle ?? '学习课程，答题赢积分'
  ctx.setFontSize(32)
  ctx.setFillStyle('#333333')
  ctx.setTextAlign('center')
  ctx.fillText(title, width / 2, y)
  
  y += 40
  
  const desc = props.config?.desc ?? authConfig?.shareDescription ?? '快来一起学习吧！'
  ctx.setFontSize(24)
  ctx.setFillStyle('#666666')
  ctx.fillText(desc, width / 2, y)
  
  y += 30
  
  const coverUrl = props.config?.coverUrl
  if (coverUrl) {
    try {
      const coverPath = await downloadImage(coverUrl)
      const coverWidth = width - padding * 2
      const coverHeight = coverWidth * 0.6
      ctx.drawImage(coverPath, padding, y, coverWidth, coverHeight)
      y += coverHeight + 20
    } catch (e) {
      console.warn('[poster] 绘制封面失败:', e)
      y += 300 + 20
    }
  }
  
  y += 20
  
  const qrSize = 180
  const qrX = (width - qrSize) / 2
  
  await generateQRCode(ctx, qrX, y, qrSize, false)
  
  y += qrSize + 15
  
  ctx.setFontSize(20)
  ctx.setFillStyle('#999999')
  ctx.setTextAlign('center')
  ctx.fillText('扫码立即体验', width / 2, y)
  
  ctx.draw(true, () => {
    generated.value = true
  })
  // #endif
}

const savePoster = () => {
  if (!generated.value) {
    uni.showToast({ title: '海报生成中', icon: 'loading' })
    return
  }
  
  // #ifdef H5
  const canvas = document.getElementById('sharePosterCanvas') as HTMLCanvasElement
  const link = document.createElement('a')
  link.download = `share-${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
  uni.showToast({ title: '已保存', icon: 'success' })
  // #endif
  
  // #ifndef H5
  uni.canvasToTempFilePath({
    canvasId: 'sharePosterCanvas',
    success: (res) => {
      uni.saveImageToPhotosAlbum({
        filePath: res.tempFilePath,
        success: () => {
          uni.showToast({ title: '已保存到相册', icon: 'success' })
        },
        fail: (err) => {
          console.error('[poster] 保存图片失败:', err)
          uni.showToast({ title: '保存失败', icon: 'error' })
        }
      })
    },
    fail: (err) => {
      console.error('[poster] 生成图片失败:', err)
      uni.showToast({ title: '生成失败', icon: 'error' })
    }
  })
  // #endif
}

watch(() => props.visible, (val) => {
  if (val) {
    setTimeout(() => {
      drawPoster()
    }, 100)
  }
})

onMounted(() => {
  if (props.visible) {
    setTimeout(() => {
      drawPoster()
    }, 100)
  }
})
</script>

<style lang="scss" scoped>
.poster-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.poster-container {
  width: 650rpx;
  max-height: 80vh;
  background: #ffffff;
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
}

.poster-header {
  padding: 30rpx;
  border-bottom: 1rpx solid #eee;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.poster-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.poster-close {
  font-size: 48rpx;
  color: #999;
  line-height: 1;
}

.poster-body {
  flex: 1;
  padding: 30rpx;
}

.poster-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.poster-canvas {
  background: #fff;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
}

.poster-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid #f0f0f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 20rpx;
  font-size: 24rpx;
  color: #999;
}

.poster-footer {
  padding: 30rpx;
  border-top: 1rpx solid #eee;
}

.save-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  text-align: center;
  padding: 24rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  font-weight: bold;
}
</style>