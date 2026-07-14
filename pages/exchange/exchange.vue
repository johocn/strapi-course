<template>
  <view class="page-container">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="header-title">积分兑换</text>
        <text class="header-subtitle">用积分兑换心仪商品</text>
      </view>
      <view class="points-card">
        <text class="points-label">我的积分</text>
        <view class="points-amount">
          <text class="points-num">{{ pointsBalance }}</text>
          <text class="points-unit">分</text>
        </view>
        <view class="points-action" @click="goToPointsRecord">
          <text>明细</text>
        </view>
      </view>
    </view>

    <view class="product-list">
      <view
        v-for="product in productList"
        :key="product.documentId || product.id"
        class="product-card"
        @click="showProductDetail(product)"
      >
        <view class="product-image">
          <image v-if="product.coverImageUrl" :src="product.coverImageUrl" mode="aspectFill" />
          <view v-else class="image-placeholder">🎁</view>
        </view>
        <view class="product-info">
          <text class="product-name">{{ product.name }}</text>
          <text class="product-subtitle" v-if="product.subtitle">{{ product.subtitle }}</text>
          <view class="product-footer">
            <text class="product-points">{{ getPriceLabel(product) }}</text>
            <text class="product-stock">库存: {{ product.stock }}</text>
          </view>
          <view class="product-tags">
            <text class="tag delivery" v-if="product.deliveryType">{{ getDeliveryLabel(product.deliveryType) }}</text>
            <text class="tag category" v-if="product.category">{{ product.category }}</text>
            <text class="tag cross-channel" v-if="product.allowCrossChannel">支持跨渠道</text>
            <text class="tag channel-only" v-if="product.allowGlobalPoints === false">仅限渠道积分</text>
          </view>
          <view
            :class="['exchange-btn', { disabled: isExchangeDisabled(product) }]"
            @click.stop="handleExchange(product)"
          >
            <text>{{ getExchangeBtnText(product) }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="!loading && productList.length === 0" class="empty-state">
      <text class="empty-icon">🎁</text>
      <text class="empty-text">暂无可兑换商品</text>
    </view>

    <!-- 兑换详情弹窗 -->
    <view v-if="showDetail" class="detail-overlay" @click="closeDetail">
      <view class="detail-modal" @click.stop>
        <scroll-view scroll-y class="detail-scroll">
          <view class="detail-header">
            <view class="detail-image">
              <image v-if="selectedProduct?.coverImageUrl" :src="selectedProduct.coverImageUrl" mode="aspectFill" />
              <view v-else class="image-placeholder">🎁</view>
            </view>
          </view>
          <view class="detail-content">
            <text class="detail-name">{{ selectedProduct?.name }}</text>
            <text class="detail-subtitle" v-if="selectedProduct?.subtitle">{{ selectedProduct.subtitle }}</text>
            <text class="detail-desc" v-if="selectedProduct?.description">{{ selectedProduct.description }}</text>
            <view class="detail-info">
              <view class="info-item" v-if="selectedProduct?.salesMode !== 'purchase_only'">
                <text class="info-label">所需积分</text>
                <text class="info-value points">{{ selectedProduct?.pointsCost }}</text>
              </view>
              <view class="info-item" v-if="selectedProduct?.salesMode === 'purchase_only'">
                <text class="info-label">售价</text>
                <text class="info-value points">¥{{ selectedProduct?.price }}<text class="price-tag">到店支付</text></text>
              </view>
              <view class="info-item" v-if="selectedProduct?.salesMode === 'hybrid'">
                <text class="info-label">所需积分</text>
                <text class="info-value points">{{ selectedProduct?.pointsCost }}<text class="price-tag">到店另付 ¥{{ selectedProduct?.price }}</text></text>
              </view>
              <view class="info-item">
                <text class="info-label">库存</text>
                <text class="info-value">{{ selectedProduct?.stock }}</text>
              </view>
              <view class="info-item">
                <text class="info-label">配送方式</text>
                <text class="info-value">{{ getDeliveryLabel(selectedProduct?.deliveryType) }}</text>
              </view>
            </view>

            <!-- 积分扣减明细 -->
            <view v-if="selectedProduct?.salesMode !== 'purchase_only'" class="deduction-panel">
              <text class="form-title">积分明细</text>
              <!-- 第1级：本渠道积分 -->
              <view class="deduction-row">
                <view class="deduction-left">
                  <text class="deduction-label">本渠道积分</text>
                  <text class="deduction-sub" v-if="selectedProduct?.allowCrossChannel || selectedProduct?.allowGlobalPoints">优先扣减</text>
                </view>
                <view class="deduction-right">
                  <text class="deduction-amount">-{{ deductionDetail.ownChannel }}</text>
                  <text class="deduction-avail">可用 {{ ownChannelBalance }}</text>
                </view>
              </view>
              <!-- 第2级：跨渠道积分 -->
              <view v-if="selectedProduct?.allowCrossChannel && availableChannelBalances.length > 0" class="deduction-section">
                <text class="deduction-section-title">跨渠道积分（选择扣减渠道）</text>
                <view
                  v-for="ch in availableChannelBalances"
                  :key="ch.channelId"
                  class="deduction-row interactive"
                  @click="toggleChannel(ch.channelId)"
                >
                  <view class="deduction-left">
                    <view :class="['checkbox-sm', { checked: form.selectedChannels.includes(ch.channelId) }]">
                      <text v-if="form.selectedChannels.includes(ch.channelId)" class="check-icon-sm">✓</text>
                    </view>
                    <text class="deduction-label">{{ ch.channelName }}</text>
                  </view>
                  <view class="deduction-right">
                    <text class="deduction-amount">-{{ getChannelDeduct(ch) }}</text>
                    <text class="deduction-avail">可用 {{ ch.balance }}</text>
                  </view>
                </view>
              </view>
              <!-- 第3级：全局积分 -->
              <view v-if="selectedProduct?.allowGlobalPoints && globalBalance > 0" class="deduction-row interactive" @click="toggleGlobalPoints">
                <view class="deduction-left">
                  <view :class="['checkbox-sm', { checked: form.useGlobalPoints }]">
                    <text v-if="form.useGlobalPoints" class="check-icon-sm">✓</text>
                  </view>
                  <text class="deduction-label">全局积分</text>
                  <text class="deduction-sub">最后扣减</text>
                </view>
                <view class="deduction-right">
                  <text class="deduction-amount">-{{ deductionDetail.global }}</text>
                  <text class="deduction-avail">可用 {{ globalBalance }}</text>
                </view>
              </view>
              <!-- 汇总 -->
              <view class="deduction-summary">
                <view class="summary-row">
                  <text class="summary-label">合计扣减</text>
                  <text class="summary-value">{{ deductionDetail.total }}积分</text>
                </view>
                <view class="summary-row" v-if="deductionDetail.shortfall > 0">
                  <text class="summary-label shortfall">积分不足</text>
                  <text class="summary-value shortfall">还差 {{ deductionDetail.shortfall }}积分</text>
                </view>
                <view class="summary-row" v-else>
                  <text class="summary-label">所需积分</text>
                  <text class="summary-value">{{ selectedProduct?.pointsCost }}积分</text>
                </view>
              </view>
            </view>

            <!-- 配送方式选择 -->
            <view class="delivery-form">
              <text class="form-title">配送方式</text>
              <view class="delivery-options">
                <view
                  v-if="showPickup"
                  :class="['delivery-option', { active: form.deliveryType === 'self_pickup' }]"
                  @click="form.deliveryType = 'self_pickup'"
                >
                  <text class="option-icon">📍</text>
                  <text class="option-text">到店自提</text>
                </view>
                <view
                  v-if="showExpress"
                  :class="['delivery-option', { active: form.deliveryType === 'express' }]"
                  @click="form.deliveryType = 'express'"
                >
                  <text class="option-icon">🚚</text>
                  <text class="option-text">快递配送</text>
                </view>
              </view>

              <!-- 快递收货信息 -->
              <view v-if="form.deliveryType === 'express'" class="address-form">
                <view class="form-item">
                  <view class="form-label-row">
                    <text class="form-label">收件人姓名 <text class="required">*</text></text>
                    <view class="form-actions" v-if="form.receiverName">
                      <text class="action-btn" @click="form.receiverName = ''">清空姓名</text>
                    </view>
                  </view>
                  <input class="form-input" v-model="form.receiverName" placeholder="请输入姓名" :focus="nameFocus" @blur="nameFocus = false" />
                </view>
                <view class="form-item">
                  <view class="form-label-row">
                    <text class="form-label">联系电话 <text class="required">*</text></text>
                    <view class="form-actions" v-if="form.receiverPhone">
                      <text class="action-btn" @click="form.receiverPhone = ''">清空电话</text>
                    </view>
                  </view>
                  <input class="form-input" v-model="form.receiverPhone" placeholder="请输入11位手机号" type="number" maxlength="11" :focus="phoneFocus" @blur="phoneFocus = false" />
                  <text class="form-error" v-if="form.receiverPhone && !isValidPhone(form.receiverPhone)">请输入正确的11位手机号（1开头）</text>
                </view>
                <view class="form-item">
                  <view class="form-label-row">
                    <text class="form-label">收货地址 <text class="required">*</text></text>
                    <view class="form-actions" v-if="form.receiverAddress">
                      <text class="action-btn" @click="form.receiverAddress = ''">清空地址</text>
                    </view>
                  </view>
                  <textarea class="form-textarea" v-model="form.receiverAddress" placeholder="请输入详细地址" />
                </view>
              </view>

              <!-- 自提信息 -->
              <view v-if="form.deliveryType === 'self_pickup'" class="pickup-info">
                <view v-if="pickupLocations.length === 0" class="pickup-tip">
                  <text>该商品未配置自提点，请选择快递配送</text>
                </view>
                <view v-else>
                  <view class="pickup-tip">
                    <text>请前往指定地点自提，工作人员将核实您的兑换信息</text>
                  </view>
                  <view class="form-item">
                    <text class="form-label">
                      选择自提点
                      <text class="required" v-if="pickupLocations.length > 1">*</text>
                      <text class="form-hint-inline" v-if="pickupLocations.length === 1">（已自动选择）</text>
                    </text>
                    <view class="pickup-radio-list">
                      <view
                        v-for="loc in pickupLocations"
                        :key="loc.documentId || loc.id"
                        :class="['pickup-radio-item', { active: form.pickupLocationId === (loc.documentId || loc.id) }]"
                        @click="selectPickupLocation(loc)"
                      >
                        <view class="pickup-radio-icon">
                          <text v-if="form.pickupLocationId === (loc.documentId || loc.id)" class="check-icon-sm">✓</text>
                        </view>
                        <view class="pickup-radio-info">
                          <text class="pickup-radio-name">{{ loc.name }}</text>
                          <text class="pickup-radio-address" v-if="loc.address">{{ loc.address }}</text>
                          <text class="pickup-radio-phone" v-if="loc.phone">📞 {{ loc.phone }}</text>
                        </view>
                      </view>
                    </view>
                  </view>
                  <view class="form-item">
                    <view class="form-label-row">
                      <text class="form-label">联系电话 <text class="required">*</text></text>
                      <view class="form-actions" v-if="form.receiverPhone">
                        <text class="action-btn" @click="form.receiverPhone = ''">清空电话</text>
                      </view>
                    </view>
                    <input class="form-input" v-model="form.receiverPhone" placeholder="请输入11位手机号（用于核实身份）" type="number" maxlength="11" :focus="phoneFocus" @blur="phoneFocus = false" />
                    <text class="form-error" v-if="form.receiverPhone && !isValidPhone(form.receiverPhone)">请输入正确的11位手机号（1开头）</text>
                  </view>
                </view>
              </view>

              <view class="form-item">
                <text class="form-label">备注</text>
                <input class="form-input" v-model="form.remark" placeholder="选填" />
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="detail-footer">
          <view
            :class="['confirm-btn', { disabled: !canConfirm }]"
            @click="confirmExchange"
          >
            <text>{{ getConfirmBtnText }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getPointBalance, getPointProductList, redeemPoints, getPickupLocationList } from '../../services/api'
import { validateLogin } from '../../utils/auth'
import { getUser } from '../../utils/storage'
import { BASE_URL } from '../../utils/env'

interface Product {
  id: number
  documentId: string
  name: string
  subtitle: string
  description: string
  detail: string
  pointsCost: number
  originalPrice: number
  stock: number
  deliveryType: string
  category: string
  coverImageUrl: string
  imagesList: string[]
  maxPerUser: number
  salesMode: string
  price: number
  channelId: string
  allowCrossChannel: boolean
  allowGlobalPoints: boolean
}

interface ChannelBalance {
  channelId: string
  channelName: string
  balance: number
}

// 积分扣减明细（前端 UI 展示用，与后端 point-redemption.deductionDetail 数组不同）
interface DeductionDetail {
  /** 本渠道扣减 */
  ownChannel: number
  /** 跨渠道扣减合计 */
  crossChannel: number
  /** 全局积分扣减 */
  global: number
  /** 合计已扣减积分 */
  total: number
  /** 不足缺口（>0 表示积分不足） */
  shortfall: number
}

const pointsBalance = ref(0)
const channelBalances = ref<ChannelBalance[]>([])
const globalBalance = ref(0)
const productList = ref<Product[]>([])
const showDetail = ref(false)
const selectedProduct = ref<Product | null>(null)
const loading = ref(false)
const nameFocus = ref(false)
const phoneFocus = ref(false)
const pickupLocations = ref<any[]>([])

const form = ref({
  deliveryType: 'express',
  receiverName: '',
  receiverPhone: '',
  receiverAddress: '',
  remark: '',
  pickupLocationId: '',
  pickupLocationName: '',
  useGlobalPoints: false,
  selectedChannels: [] as string[],
})

const deliveryLabels: Record<string, string> = {
  self_pickup: '到店自提',
  express: '快递配送',
  both: '自提/快递',
}

function getDeliveryLabel(type?: string) {
  return deliveryLabels[type || ''] || type || ''
}

function getPriceLabel(product: Product) {
  const mode = product.salesMode || 'points_only'
  const points = product.pointsCost || 0
  const price = parseFloat(String(product.price || 0)) || 0

  if (mode === 'purchase_only') {
    return price > 0 ? `¥${price}` : ''
  }
  if (mode === 'hybrid') {
    const pointPart = points > 0 ? `${points}积分` : ''
    const pricePart = price > 0 ? `¥${price}` : ''
    if (pointPart && pricePart) return `${pointPart} + ${pricePart}`
    if (pointPart) return pointPart
    if (pricePart) return `¥${price}`
    return ''
  }
  return points > 0 ? `${points}积分` : ''
}

function isExchangeDisabled(product: Product) {
  if (product.stock <= 0) return true
  const mode = product.salesMode || 'points_only'
  if (mode === 'purchase_only') return false
  return pointsBalance.value < product.pointsCost
}

function getExchangeBtnText(product: Product) {
  if (product.stock <= 0) return '已售罄'
  const mode = product.salesMode || 'points_only'
  if (mode === 'purchase_only') return '购买'
  if (pointsBalance.value < product.pointsCost) return '积分不足'
  return '兑换'
}

async function loadPickupLocations(channelId: string) {
  if (!channelId) { pickupLocations.value = []; return }
  try {
    const res = await getPickupLocationList({ channelId })
    const data = (res as any)?.data || {}
    let list: any[] = data.records || data.list || []
    if (!Array.isArray(list)) list = Array.isArray(data) ? data : []
    pickupLocations.value = list
  } catch {
    pickupLocations.value = []
  }
}

function selectPickupLocation(loc: any) {
  form.value.pickupLocationId = loc.documentId || loc.id
  form.value.pickupLocationName = loc.name
}

const showPickup = computed(() => {
  const dt = selectedProduct.value?.deliveryType
  if (!(dt === 'self_pickup' || dt === 'both')) return false
  // 跨渠道商品（无 channelId）不显示自提选项
  if (!selectedProduct.value?.channelId) return false
  return true
})

const showExpress = computed(() => {
  const dt = selectedProduct.value?.deliveryType
  return dt === 'express' || dt === 'both'
})

// 本渠道积分余额
const ownChannelBalance = computed(() => {
  const currentChannelId = selectedProduct.value?.channelId
  const own = channelBalances.value.find(ch => ch.channelId === currentChannelId)
  return own?.balance || pointsBalance.value
})

// 积分扣减明细计算（按三级扣减顺序）
const deductionDetail = computed<DeductionDetail>(() => {
  const cost = selectedProduct.value?.pointsCost || 0
  let remaining = cost

  // 第1级：本渠道
  const ownDeduct = Math.min(ownChannelBalance.value, remaining)
  remaining -= ownDeduct

  // 第2级：选中的跨渠道
  let crossChannelDeduct = 0
  if (selectedProduct.value?.allowCrossChannel) {
    for (const chId of form.value.selectedChannels) {
      if (remaining <= 0) break
      const ch = channelBalances.value.find(c => c.channelId === chId)
      if (ch) {
        const d = Math.min(ch.balance, remaining)
        crossChannelDeduct += d
        remaining -= d
      }
    }
  }

  // 第3级：全局积分
  let globalDeduct = 0
  if (remaining > 0 && selectedProduct.value?.allowGlobalPoints && form.value.useGlobalPoints) {
    globalDeduct = Math.min(globalBalance.value, remaining)
    remaining -= globalDeduct
  }

  return {
    ownChannel: ownDeduct,
    crossChannel: crossChannelDeduct,
    global: globalDeduct,
    total: cost - remaining,
    shortfall: remaining,
  }
})

// 获取某个跨渠道的扣减金额
function getChannelDeduct(ch: ChannelBalance) {
  if (!form.value.selectedChannels.includes(ch.channelId)) return 0
  const cost = selectedProduct.value?.pointsCost || 0
  let remaining = cost - deductionDetail.value.ownChannel
  for (const chId of form.value.selectedChannels) {
    if (remaining <= 0) break
    const c = channelBalances.value.find(x => x.channelId === chId)
    if (c) {
      const d = Math.min(c.balance, remaining)
      if (chId === ch.channelId) return d
      remaining -= d
    }
  }
  return 0
}

function toggleGlobalPoints() {
  form.value.useGlobalPoints = !form.value.useGlobalPoints
}

// 本渠道积分是否不足
const isChannelPointsInsufficient = computed(() => {
  if (!selectedProduct.value) return false
  const mode = selectedProduct.value.salesMode || 'points_only'
  if (mode === 'purchase_only') return false
  return pointsBalance.value < selectedProduct.value.pointsCost
})

// 是否显示渠道积分选择（allowCrossChannel=true 且本渠道积分不足）
const showChannelSelector = computed(() => {
  if (!selectedProduct.value?.allowCrossChannel) return false
  return isChannelPointsInsufficient.value && availableChannelBalances.value.length > 0
})

// 是否显示全局积分开关（allowGlobalPoints=true 且渠道积分不足）
const showGlobalPointsToggle = computed(() => {
  if (!selectedProduct.value?.allowGlobalPoints) return false
  return isChannelPointsInsufficient.value && globalBalance.value > 0
})

// 可选的其他渠道余额（排除本渠道）
const availableChannelBalances = computed(() => {
  const currentChannelId = selectedProduct.value?.channelId
  return channelBalances.value.filter(ch => ch.channelId !== currentChannelId && ch.balance > 0)
})

function toggleChannel(channelId: string) {
  const idx = form.value.selectedChannels.indexOf(channelId)
  if (idx >= 0) {
    form.value.selectedChannels.splice(idx, 1)
  } else {
    form.value.selectedChannels.push(channelId)
  }
}

function isValidPhone(phone: string) {
  return /^1[3-9]\d{9}$/.test(phone.trim())
}

const canConfirm = computed(() => {
  if (!selectedProduct.value) return false
  const mode = selectedProduct.value.salesMode || 'points_only'
  if (mode !== 'purchase_only') {
    if (deductionDetail.value.shortfall > 0) return false
  }
  if (selectedProduct.value.stock <= 0) return false
  if (form.value.deliveryType === 'express') {
    return form.value.receiverName.trim() !== '' &&
      isValidPhone(form.value.receiverPhone) &&
      form.value.receiverAddress.trim() !== ''
  }
  if (form.value.deliveryType === 'self_pickup') {
    // 多个自提点时必须选一个
    if (pickupLocations.value.length > 1 && !form.value.pickupLocationId) return false
    return isValidPhone(form.value.receiverPhone)
  }
  return true
})

function getTotalAvailablePoints() {
  let total = pointsBalance.value
  if (form.value.useGlobalPoints) total += globalBalance.value
  form.value.selectedChannels.forEach(chId => {
    const ch = channelBalances.value.find(c => c.channelId === chId)
    if (ch) total += ch.balance
  })
  return total
}

const getConfirmBtnText = computed(() => {
  const p = selectedProduct.value
  if (!p) return '确认兑换'
  const mode = p.salesMode || 'points_only'
  if (mode === 'purchase_only') return `确认购买（到店付¥${p.price}）`
  if (deductionDetail.value.shortfall > 0) return `积分不足（还差${deductionDetail.value.shortfall}分）`
  if (mode === 'hybrid') return `确认兑换（${p.pointsCost}积分 + 到店付¥${p.price}）`
  return `确认兑换（${deductionDetail.value.total}积分）`
})

function getMediaUrl(media: any) {
  if (!media) return ''
  if (typeof media === 'string') return media
  const url = media.url || media.formats?.thumbnail?.url || ''
  if (url.startsWith('http')) return url
  return `${BASE_URL}${url}`
}

async function loadData() {
  loading.value = true
  try {
    const [balanceRes, productRes] = await Promise.all([
      getPointBalance(),
      getPointProductList({ status: 'on_shelf' }),
    ])
    pointsBalance.value = (balanceRes as any)?.balance ?? 0
    channelBalances.value = (balanceRes as any)?.channelBalances || []
    globalBalance.value = (balanceRes as any)?.globalBalance ?? 0

    const rawList = (productRes as any)?.data?.records || (productRes as any)?.records || (productRes as any)?.data || []
    productList.value = rawList.map((p: any) => ({
      id: p.id,
      documentId: p.documentId,
      name: p.name || '',
      subtitle: p.subtitle || '',
      description: p.description || '',
      detail: p.detail || '',
      pointsCost: p.pointsCost || 0,
      originalPrice: p.originalPrice || 0,
      stock: p.stock ?? 0,
      deliveryType: p.deliveryType || 'express',
      category: p.category || '',
      coverImageUrl: getMediaUrl(p.coverImage),
      imagesList: (p.images || []).map((img: any) => getMediaUrl(img)),
      maxPerUser: p.maxPerUser || 0,
      salesMode: p.salesMode || 'points_only',
      price: parseFloat(p.price) || 0,
      channelId: p.channel?.documentId || p.channelId || '',
      allowCrossChannel: p.allowCrossChannel || false,
      allowGlobalPoints: p.allowGlobalPoints !== false,
    }))
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

async function showProductDetail(product: Product) {
  // 先赋值，让 computed 生效
  selectedProduct.value = product
  // 根据商品配送类型设置默认配送方式
  if (product.deliveryType === 'self_pickup') {
    form.value.deliveryType = 'self_pickup'
  } else {
    form.value.deliveryType = 'express'
  }
  // 从用户信息自动填充姓名和手机号
  const user = getUser()
  form.value.receiverName = user?.name || user?.nickname || user?.username || ''
  form.value.receiverPhone = user?.phone || ''
  form.value.receiverAddress = ''
  form.value.remark = ''
  form.value.pickupLocationId = ''
  form.value.pickupLocationName = ''

  // 自提点兜底逻辑：拉取商品渠道下的自提点
  // 跨渠道商品（无 channelId）不查自提点 → 自提选项隐藏（见 showPickup）
  // 指定渠道商品按 channelId 查自提点：0 → 强制快递 / 1 → 自动选中 / >1 → 等用户选
  pickupLocations.value = []
  const dt = product.deliveryType
  const supportPickup = (dt === 'self_pickup' || dt === 'both') && product.channelId
  if (supportPickup) {
    await loadPickupLocations(product.channelId)
    if (pickupLocations.value.length === 0) {
      // 无自提点，强制快递
      form.value.deliveryType = 'express'
    } else if (pickupLocations.value.length === 1) {
      // 兜底自动选中
      const loc = pickupLocations.value[0]
      form.value.pickupLocationId = loc.documentId || loc.id
      form.value.pickupLocationName = loc.name
    } else {
      // 多个自提点，清空选择等用户选
      form.value.pickupLocationId = ''
      form.value.pickupLocationName = ''
    }
  } else if ((dt === 'self_pickup' || dt === 'both') && !product.channelId) {
    // 跨渠道商品无指定渠道：清空自提点，强制快递
    pickupLocations.value = []
    form.value.deliveryType = 'express'
  }

  // 按扣减顺序自动选中渠道，直到积分够用
  const cost = product.pointsCost || 0
  let remaining = cost

  // 第1级：本渠道（始终参与，无需选择）
  const ownBal = ownChannelBalance.value
  remaining -= Math.min(ownBal, remaining)

  // 第2级：按顺序选中跨渠道，直到够用
  const autoSelected: string[] = []
  if (remaining > 0 && product.allowCrossChannel) {
    for (const ch of availableChannelBalances.value) {
      if (remaining <= 0) break
      autoSelected.push(ch.channelId)
      remaining -= Math.min(ch.balance, remaining)
    }
  }
  form.value.selectedChannels = autoSelected

  // 第3级：如果还不够，自动开启全局积分
  form.value.useGlobalPoints = remaining > 0 && product.allowGlobalPoints && globalBalance.value > 0

  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  selectedProduct.value = null
}

function handleExchange(product: Product) {
  showProductDetail(product)
}

async function confirmExchange() {
  if (!selectedProduct.value || !canConfirm.value) return

  try {
    const res = await redeemPoints({
      productId: selectedProduct.value.documentId || selectedProduct.value.id,
      pointsCost: selectedProduct.value.pointsCost,
      quantity: 1,
      deliveryType: form.value.deliveryType,
      receiverName: form.value.deliveryType === 'express' ? form.value.receiverName : (form.value.receiverName || undefined),
      receiverPhone: form.value.receiverPhone,
      receiverAddress: form.value.deliveryType === 'express' ? form.value.receiverAddress : '自提',
      remark: form.value.remark || undefined,
      pickupLocationId: form.value.pickupLocationId || undefined,
      useGlobalPoints: form.value.useGlobalPoints || undefined,
      selectedChannels: form.value.selectedChannels.length > 0 ? form.value.selectedChannels : undefined,
    })
    const mode = selectedProduct.value.salesMode || 'points_only'
    const successMsg = mode === 'purchase_only' ? '购买成功！' : '兑换成功！'
    uni.showToast({ title: successMsg, icon: 'success' })

    // 获取兑换码
    const redeemCode = (res as any)?.pickupCode || (res as any)?.data?.pickupCode || ''
    const deliveryType = form.value.deliveryType

    setTimeout(() => {
      if (deliveryType === 'self_pickup') {
        const codeMsg = redeemCode ? `\n兑换码：${redeemCode}` : ''
        uni.showModal({
          title: '兑换成功',
          content: `请携带手机到店出示兑换码，工作人员核实后即可兑付商品${codeMsg}`,
          confirmText: '查看记录',
          cancelText: '继续兑换',
          success: (res) => {
            if (res.confirm) {
              uni.navigateTo({ url: '/pages/redeem-record/redeem-record' })
            }
          },
        })
      } else {
        const codeMsg = redeemCode ? `\n兑换码：${redeemCode}` : ''
        uni.showModal({
          title: '兑换成功',
          content: `商品将快递发出，您可在兑换记录中查看物流信息${codeMsg}`,
          confirmText: '查看物流',
          cancelText: '继续兑换',
          success: (res) => {
            if (res.confirm) {
              uni.navigateTo({ url: '/pages/redeem-record/redeem-record' })
            }
          },
        })
      }
    }, 1500)
    closeDetail()
    loadData()
  } catch (e: any) {
    uni.showToast({ title: e.message || '兑换失败', icon: 'none' })
  }
}

function goToPointsRecord() {
  uni.navigateTo({ url: '/pages/points-record/points-record' })
}

function checkLoginStatus() {
  if (!validateLogin()) {
    uni.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
    setTimeout(() => { uni.navigateTo({ url: '/pages/login/login' }) }, 1500)
    return false
  }
  return true
}

onMounted(() => {
  if (checkLoginStatus()) loadData()
})
onShow(() => { if (checkLoginStatus()) loadData() })
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.header {
  position: relative;
  padding: 40rpx 30rpx;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 300rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-content { position: relative; z-index: 1; }
.header-title { display: block; font-size: 40rpx; font-weight: bold; color: #fff; }
.header-subtitle { font-size: 26rpx; color: rgba(255,255,255,0.8); margin-top: 10rpx; }

.points-card {
  position: relative; z-index: 1; margin-top: 20rpx;
  background: #fff; border-radius: 20rpx; padding: 25rpx;
  display: flex; justify-content: space-between; align-items: center;
  box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.1);
}
.points-label { font-size: 26rpx; color: #999; }
.points-amount { display: flex; align-items: baseline; }
.points-num { font-size: 48rpx; font-weight: bold; color: #667eea; }
.points-unit { font-size: 24rpx; color: #999; margin-left: 8rpx; }
.points-action { color: #667eea; font-size: 28rpx; }

.product-list {
  padding: 20rpx 30rpx;
  display: flex; flex-wrap: wrap; gap: 20rpx;
}

.product-card {
  width: calc(50% - 10rpx);
  background: #fff; border-radius: 16rpx; overflow: hidden;
}

.product-image {
  width: 100%; height: 200rpx; background: #f5f5f5;
}
.product-image image { width: 100%; height: 100%; }
.image-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center; font-size: 60rpx;
}

.product-info { padding: 20rpx; }
.product-name { display: block; font-size: 28rpx; font-weight: 500; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-subtitle { display: block; font-size: 22rpx; color: #999; margin-top: 4rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 12rpx; }
.product-points { font-size: 26rpx; color: #f5576c; font-weight: bold; }
.product-stock { font-size: 22rpx; color: #999; }

.product-tags { display: flex; gap: 8rpx; margin-top: 8rpx; }
.tag { font-size: 20rpx; padding: 2rpx 10rpx; border-radius: 6rpx; }
.tag.delivery { background: #f0f4ff; color: #667eea; }
.tag.category { background: #f5f5f5; color: #999; }
.tag.cross-channel { background: #e6fffb; color: #13c2c2; }
.tag.channel-only { background: #fff7e6; color: #fa8c16; }

.exchange-btn {
  margin-top: 12rpx; text-align: center; padding: 12rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12rpx; font-size: 26rpx; color: #fff;
  &.disabled { background: #ccc; color: #999; }
}

.empty-state { padding: 100rpx 30rpx; text-align: center; }
.empty-icon { font-size: 80rpx; display: block; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; }

/* 兑换弹窗 */
.detail-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; z-index: 1000;
}

.detail-modal {
  width: 100%; max-height: 85vh; background: #fff;
  border-radius: 30rpx 30rpx 0 0; overflow: hidden;
  display: flex; flex-direction: column;
}

.detail-scroll {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.detail-header { background: #f5f5f5; }
.detail-image { width: 100%; height: 300rpx; }
.detail-image image { width: 100%; height: 100%; }

.detail-content { padding: 30rpx; }
.detail-name { display: block; font-size: 36rpx; font-weight: bold; color: #333; }
.detail-subtitle { display: block; font-size: 26rpx; color: #999; margin-top: 8rpx; }
.detail-desc { display: block; font-size: 28rpx; color: #666; margin-top: 15rpx; line-height: 1.5; }

.detail-info { margin-top: 25rpx; }
.info-item { display: flex; justify-content: space-between; padding: 20rpx 0; border-bottom: 1rpx solid #eee; }
.info-label { font-size: 28rpx; color: #999; }
.info-value { font-size: 28rpx; color: #333; &.points { color: #f5576c; font-weight: bold; } &.enough { color: #52c41a; } &.not-enough { color: #ff4d4f; } }

.detail-rich { margin-top: 20rpx; }
.detail-images { margin-top: 20rpx; }
.detail-img { width: 100%; border-radius: 8rpx; margin-bottom: 10rpx; }

.delivery-form { margin-top: 30rpx; padding-top: 20rpx; border-top: 1rpx solid #eee; }
.form-title { display: block; font-size: 30rpx; font-weight: bold; color: #333; margin-bottom: 20rpx; }

.delivery-options { display: flex; gap: 20rpx; margin-bottom: 20rpx; }
.delivery-option {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 10rpx;
  padding: 20rpx; background: #f5f5f5; border-radius: 12rpx;
  font-size: 28rpx; color: #666; border: 2rpx solid transparent;
}
.delivery-option.active { background: #f0f4ff; color: #667eea; border-color: #667eea; }

.address-form, .pickup-info { margin-top: 10rpx; }
.pickup-tip { background: #fffbe6; padding: 20rpx; border-radius: 8rpx; margin-bottom: 15rpx; font-size: 26rpx; color: #faad14; }

.form-item { margin-bottom: 15rpx; }
.form-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.form-actions { display: flex; gap: 16rpx; }
.action-btn { font-size: 24rpx; color: #667eea; padding: 4rpx 12rpx; }
.form-label { display: block; font-size: 26rpx; color: #666; margin-bottom: 10rpx; }
.form-error { font-size: 22rpx; color: #ff4d4f; margin-top: 6rpx; display: block; }
.phone-input-row { display: flex; align-items: center; gap: 16rpx; }
.flex-1 { flex: 1; }
.required { color: #ff4d4f; }
.form-input {
  width: 100%; height: 80rpx; padding: 0 20rpx;
  background: #f5f5f5; border-radius: 12rpx; font-size: 28rpx; color: #333; box-sizing: border-box;
}
.form-textarea {
  width: 100%; min-height: 100rpx; padding: 20rpx;
  background: #f5f5f5; border-radius: 12rpx; font-size: 28rpx; color: #333; box-sizing: border-box;
}

.detail-footer {
  flex-shrink: 0;
  padding: 20rpx 30rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #eee;
}

.confirm-btn {
  text-align: center; padding: 25rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx; font-size: 32rpx; font-weight: bold; color: #fff;
  &.disabled { background: #ccc; color: #999; }
}

.pickup-location-select {
  display: flex; justify-content: space-between; align-items: center;
  height: 80rpx; padding: 0 20rpx;
  background: #f5f5f5; border-radius: 12rpx;
}
.pickup-location-text { font-size: 28rpx; color: #333; }
.pickup-location-text.placeholder { color: #999; }
.pickup-location-arrow { color: #999; font-size: 28rpx; }
.price-tag { font-size: 22rpx; color: #fa8c16; background: #fff7e6; padding: 2rpx 10rpx; border-radius: 6rpx; margin-left: 10rpx; }

/* 渠道积分选择 */
.channel-selector {
  margin-top: 25rpx; padding: 20rpx;
  background: #f9f9fb; border-radius: 12rpx;
}
.channel-tip { font-size: 24rpx; color: #999; margin-top: 8rpx; margin-bottom: 16rpx; }
.channel-check-item {
  display: flex; align-items: center; gap: 16rpx;
  padding: 16rpx 0; border-bottom: 1rpx solid #eee;
  &:last-child { border-bottom: none; }
}
.checkbox {
  width: 40rpx; height: 40rpx; border-radius: 8rpx;
  border: 2rpx solid #d9d9d9; display: flex; align-items: center; justify-content: center;
  background: #fff; flex-shrink: 0;
  &.checked { background: #667eea; border-color: #667eea; }
}
.check-icon { color: #fff; font-size: 24rpx; }
.channel-name { flex: 1; font-size: 28rpx; color: #333; }
.channel-balance { font-size: 26rpx; color: #667eea; font-weight: 500; }

/* 全局积分开关 */
.global-points-toggle {
  margin-top: 20rpx; padding: 20rpx;
  background: #f0f4ff; border-radius: 12rpx;
}
.toggle-row { display: flex; justify-content: space-between; align-items: center; }
.toggle-info { flex: 1; }
.toggle-label { font-size: 28rpx; color: #333; font-weight: 500; }
.toggle-desc { display: block; font-size: 24rpx; color: #999; margin-top: 4rpx; }

/* 积分扣减明细面板 */
.deduction-panel {
  margin-top: 25rpx; padding: 24rpx;
  background: #fafbfc; border-radius: 16rpx;
  border: 1rpx solid #eef0f3;
}
.deduction-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16rpx 0; border-bottom: 1rpx solid #f0f0f0;
  &.interactive { cursor: pointer; }
  &:last-child { border-bottom: none; }
}
.deduction-left {
  display: flex; align-items: center; gap: 12rpx; flex: 1;
}
.deduction-label { font-size: 28rpx; color: #333; font-weight: 500; }
.deduction-sub { font-size: 22rpx; color: #999; background: #f0f0f0; padding: 2rpx 10rpx; border-radius: 6rpx; }
.deduction-right {
  display: flex; align-items: center; gap: 16rpx; flex-shrink: 0;
}
.deduction-amount { font-size: 28rpx; color: #f5576c; font-weight: bold; }
.deduction-avail { font-size: 22rpx; color: #999; }
.deduction-section {
  margin-top: 8rpx; padding-top: 8rpx;
  border-top: 1rpx dashed #e0e0e0;
}
.deduction-section-title {
  display: block; font-size: 24rpx; color: #999; margin-bottom: 8rpx;
}
.checkbox-sm {
  width: 36rpx; height: 36rpx; border-radius: 8rpx;
  border: 2rpx solid #d9d9d9; display: flex; align-items: center; justify-content: center;
  background: #fff; flex-shrink: 0;
  &.checked { background: #667eea; border-color: #667eea; }
}
.check-icon-sm { color: #fff; font-size: 22rpx; }
.deduction-summary {
  margin-top: 16rpx; padding-top: 16rpx;
  border-top: 2rpx solid #e0e0e0;
}
.summary-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6rpx 0;
}
.summary-label { font-size: 26rpx; color: #666; &.shortfall { color: #ff4d4f; font-weight: bold; } }
.summary-value { font-size: 28rpx; color: #333; font-weight: bold; &.shortfall { color: #ff4d4f; } }
/* 内联自提点单选列表 */
.pickup-radio-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.pickup-radio-item {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 20rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  border: 2rpx solid transparent;
  &.active {
    background: #f0f4ff;
    border-color: #667eea;
  }
}
.pickup-radio-icon {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  border: 2rpx solid #d9d9d9;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;
  background: #fff;
  .pickup-radio-item.active & {
    background: #667eea;
    border-color: #667eea;
  }
}
.pickup-radio-info {
  flex: 1;
  min-width: 0;
}
.pickup-radio-name {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}
.pickup-radio-address {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pickup-radio-phone {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}
.form-hint-inline {
  font-size: 22rpx;
  color: #999;
  margin-left: 8rpx;
}
</style>
