<template>
  <view v-if="visible" class="poster-overlay" @click.self="close">
    <view class="poster-container">
      <view class="poster-header">
        <text class="poster-title">分享海报</text>
        <view class="poster-close" @click="close">×</view>
      </view>
      <scroll-view scroll-y class="poster-body">
        <view class="poster-preview">
          <!-- #ifndef H5 -->
          <!-- 非H5（小程序/App）：使用画布渲染 -->
          <canvas 
            canvas-id="sharePosterCanvas"
            :style="{ width: canvasWidth + 'rpx', height: canvasHeight + 'rpx' }"
            class="poster-canvas"
          />
          <!-- #endif -->
          <!-- H5：离屏画布生成图片后展示，适配手机宽度并支持长按保存 -->
          <image
            v-if="posterImage"
            :src="posterImage"
            :style="{ width: posterDisplayW + 'px', height: posterDisplayH + 'px', transform: `translateX(-${posterShift}px)` }"
            class="poster-img"
            :show-menu-by-longpress="true"
          />
          <view v-if="!generated" class="poster-loading">
            <view class="loading-spinner" />
            <text class="loading-text">正在生成海报...</text>
          </view>
        </view>
      </scroll-view>
      <view class="poster-footer">
        <view class="poster-tip">
          <text v-if="isWechat">长按图片即可保存到手机相册</text>
          <text v-else>点击下方「保存图片」下载海报</text>
        </view>
        <view class="save-btn" @click="savePoster">保存图片</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { getInviteCode } from '@/utils/invite'
import { getUser } from '@/utils/storage'
import { getImageUrl } from '@/utils/env'
import { getStoredAuthConfig } from '@/services/auth-config'
import { PosterRenderer } from '@/utils/poster-renderer'
import { resolveTemplateLocal, BUILTIN_TEMPLATES } from '@/utils/poster-templates'
import { renderPoster } from '@/utils/ad-api'

interface PosterConfig {
  // 模板编码（brand_share / course_share / product_share），缺省 brand_share
  templateCode?: string
  // 页面实时变量（模板变量名 → 值）
  variables?: Record<string, string>
  // 分享落地页路径
  pagePath?: string
  // 向后兼容：旧调用传 title/desc/coverUrl
  title?: string
  desc?: string
  coverUrl?: string
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
const posterImage = ref('')
const posterDisplayW = ref(0)
const posterDisplayH = ref(0)
const posterShift = ref(0)
const posterFilename = ref('分享海报.png')
// 是否在微信内：微信内长按图片保存，浏览器点按钮下载
const isWechat = (() => {
  // #ifdef H5
  return typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('micromessenger')
  // #endif
  // #ifndef H5
  return false
  // #endif
})()
const canvasWidth = ref(600)
const canvasHeight = ref(1000)

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

/**
 * 构建海报渲染变量：
 * 页面实时变量 → 向后兼容映射（title/desc/coverUrl）→ 兜底字段 → 二维码/邀请码
 */
const buildVariables = (): Record<string, string> => {
  const authConfig = getStoredAuthConfig()
  const user = getUser()
  const templateCode = props.config?.templateCode || 'brand_share'
  const vars: Record<string, string> = { ...(props.config?.variables || {}) }

  // 向后兼容：旧调用（title/desc/coverUrl）映射到模板变量
  if (templateCode === 'brand_share') {
    if (!vars.title) vars.title = props.config?.title || authConfig?.siteName || ''
    if (!vars.values) vars.values = props.config?.desc || authConfig?.siteDescription || ''
    if (!vars.main_image) {
      const img = props.config?.coverUrl || authConfig?.shareImage
      vars.main_image = getImageUrl(img) || ''
    }
    if (!vars.logo) vars.logo = authConfig?.logo || ''
  } else if (templateCode === 'course_share') {
    if (!vars.user_name) vars.user_name = user?.nickname || user?.name || authConfig?.posterDefaultUserName || ''
    if (!vars.user_avatar) vars.user_avatar = user?.avatar ? getImageUrl(user.avatar) : (authConfig?.posterDefaultUserAvatar || '')
    if (!vars.course_image) vars.course_image = getImageUrl(props.config?.coverUrl) || ''
    if (!vars.recommend_reason) vars.recommend_reason = props.config?.desc || authConfig?.posterDefaultRecommendReason || ''
  } else if (templateCode === 'product_share') {
    if (!vars.user_name) vars.user_name = user?.nickname || user?.name || authConfig?.posterDefaultUserName || ''
    if (!vars.user_avatar) vars.user_avatar = user?.avatar ? getImageUrl(user.avatar) : (authConfig?.posterDefaultUserAvatar || '')
    if (!vars.recommend_reason) vars.recommend_reason = props.config?.desc || authConfig?.posterDefaultRecommendReason || ''
  }

  // 二维码与邀请码
  vars.qr_code = getShareUrl()
  vars.invite_code = getInviteCode()
  return vars
}

/**
 * 获取渲染数据：
 * 1. 后端模板优先（/posters/render，defaultValue 优先于页面变量）
 * 2. 内置模板按 elementKey 兜底补全空的 resolvedContent
 * 3. 后端不可用 → 本地解析（resolveTemplateLocal，优先级逻辑一致）
 */
const fetchRenderData = async (templateCode: string, variables: Record<string, string>) => {
  const apiResult = await renderPoster(templateCode, variables)
  if (apiResult && apiResult.template && Array.isArray(apiResult.elements)) {
    const builtin = BUILTIN_TEMPLATES[templateCode]
    if (builtin) {
      apiResult.elements.forEach((el: any) => {
        if (!el.resolvedContent) {
          const builtinEl = builtin.elements.find((e: any) => e.elementKey === el.elementKey)
          if (builtinEl) {
            el.resolvedContent = el.isVariable ? (builtinEl.defaultValue || '') : (builtinEl.content || '')
          }
        }
      })
    }
    return apiResult
  }
  return resolveTemplateLocal(templateCode, variables)
}

const drawPoster = async () => {
  generated.value = false

  const templateCode = props.config?.templateCode || 'brand_share'
  const variables = buildVariables()
  const renderData = await fetchRenderData(templateCode, variables)
  if (!renderData || !renderData.template || !renderData.elements) {
    console.error('[poster] 无法获取海报渲染数据')
    uni.showToast({ title: '海报生成失败', icon: 'none' })
    return
  }

  const template = renderData.template
  const width = template.canvasWidth || 600
  const height = template.canvasHeight || 1000
  canvasWidth.value = width
  canvasHeight.value = height
  const renderer = new PosterRenderer(width, height)

  // #ifdef H5
  // 使用离屏 canvas，缓冲尺寸完全可控（600x1000），避免 uni-canvas 包装的 DPR/布局缩放导致画面缩小或截断
  const offCanvas = document.createElement('canvas')
  offCanvas.width = width
  offCanvas.height = height
  const ctx = offCanvas.getContext('2d')
  if (!ctx) return
  await renderer.render(ctx, template, renderData.elements, true)
  posterImage.value = offCanvas.toDataURL('image/png')
  // 计算显示尺寸：等比缩放，完整放入分享区域（不溢出、不裁剪）
  // 容器宽 650rpx，左右 padding 各 30rpx → 内容宽 590rpx；max-height 80vh 减去头部/保存按钮为可用高度
  const areaW = (590 * window.innerWidth) / 750
  const areaH = Math.max(window.innerHeight * 0.8 - 190, 260)
  const scale = Math.min(areaW / width, areaH / height)
  posterDisplayW.value = Math.round(width * scale)
  posterDisplayH.value = Math.round(height * scale)
  // 图片在分享海报容器（650rpx）内居中，左右各留白。
  // 容器宽 650rpx 才是分享海报的真实宽度，用它与图片宽计算右侧留白，再左移一半，
  // 让图片明显靠左、减少左侧空间；img 宽+左移量 <= 容器宽，保证不超出右侧。
  const containerW = (650 * window.innerWidth) / 750
  const leftGap = Math.max(containerW - posterDisplayW.value, 0)
  posterShift.value = Math.round(leftGap / 2)
  // 有意义的下载文件名
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  posterFilename.value = `${template.name || '分享海报'}-${dateStr}.png`
  generated.value = true
  // #endif

  // #ifndef H5
  const ctx = uni.createCanvasContext('sharePosterCanvas')
  await renderer.render(ctx, template, renderData.elements, false)
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
  // dataURL -> Blob 下载，兼容移动端浏览器（直接点击 dataURL 链接经常被拦截）
  const arr = posterImage.value.split(',')
  const mime = (arr[0].match(/:(.*?);/)?.[1]) || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  const blob = new Blob([u8arr], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = posterFilename.value
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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

/* H5：展示的图片，等比缩放完整放入分享区域，支持长按保存 */
.poster-img {
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.poster-tip {
  font-size: 24rpx;
  color: #999;
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