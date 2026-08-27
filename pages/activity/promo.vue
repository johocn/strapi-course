<template>
  <view class="promo-page" :class="styleClass" :style="colorVars">
    <!-- 分享海报入口（固定右上角） -->
    <view v-if="page?.activity" class="promo-share-btn" @click="showSharePoster = true">
      <text>分享海报</text>
    </view>

    <!-- 模块分发 -->
    <block v-if="page?.activity && modules.length">
      <block v-for="m in modules" :key="m.sort">
        <PromoCover v-if="m.type === 'cover'" :activity="page.activity" :config="m.config" />
        <PromoInfo v-else-if="m.type === 'info'" :activity="page.activity" :config="m.config" />
        <PromoRich v-else-if="m.type === 'rich'" :activity="page.activity" :config="m.config" />
        <PromoHighlights v-else-if="m.type === 'highlights'" :activity="page.activity" :config="m.config" />
        <PromoSpeakers v-else-if="m.type === 'speakers'" :activity="page.activity" :config="m.config" />
        <PromoAgenda v-else-if="m.type === 'agenda'" :activity="page.activity" :config="m.config" />
        <PromoImages v-else-if="m.type === 'images'" :activity="page.activity" :config="m.config" />
        <PromoRewards v-else-if="m.type === 'rewards'" :rewards="page.rewards" />
        <PromoContact
          v-else-if="m.type === 'contact'"
          :contact="page.contact"
          @open-wechat="openWechat"
          @call-phone="callPhone"
          @open-card="openCard"
          @open-message="openMessagePanel"
        />
        <PromoMessage v-else-if="m.type === 'message'" :messages="messages" @open-message="openMessagePanel" />
        <PromoFaq v-else-if="m.type === 'faq'" :activity="page.activity" :config="m.config" />
        <PromoCustom v-else-if="m.type === 'custom'" :activity="page.activity" :config="m.config" />
      </block>
    </block>

    <!-- 底部固定报名栏 -->
    <view v-if="page?.activity" class="promo-footer">
      <view class="promo-btn-primary" @click="onSignup"><text>{{ signupBtnText }}</text></view>
    </view>

    <!-- 加载中 / 失败重试 -->
    <view v-if="!page && loading" class="promo-state"><text>加载中...</text></view>
    <view v-if="!page && !loading" class="promo-state promo-state--retry" @click="loadPage">
      <text>加载失败，点击重试</text>
    </view>

    <!-- 普通报名表单弹层 -->
    <view class="signup-mask" v-if="showSignupForm" @click="showSignupForm = false">
      <view class="signup-panel" @click.stop>
        <text class="signup-title">填写报名信息</text>
        <view v-for="f in formFields" :key="f.key" class="signup-field">
          <text class="signup-label">{{ f.label }}<text v-if="f.required" class="req">*</text></text>

          <input v-if="f.type === 'text' || f.type === 'phone'" class="signup-input"
            v-model="signupData[f.key]" :type="f.type === 'phone' ? 'number' : 'text'"
            :placeholder="f.placeholder || ''" />

          <textarea v-else-if="f.type === 'textarea'" class="signup-textarea" v-model="signupData[f.key]" />

          <view v-else-if="f.type === 'radio'" class="signup-options">
            <text v-for="o in (f.options || [])" :key="o" class="signup-opt"
              :class="{ on: signupData[f.key] === o }" @click="signupData[f.key] = o">{{ o }}</text>
          </view>

          <picker v-else-if="f.type === 'select'" mode="selector" :range="(f.options || [])"
            @change="e => signupData[f.key] = (f.options || [])[Number(e.detail.value)]">
            <view class="signup-picker">
              <text>{{ signupData[f.key] || '请选择' }}</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>

          <view v-else-if="f.type === 'multi'" class="signup-options">
            <text v-for="o in (f.options || [])" :key="o" class="signup-opt"
              :class="{ on: (signupData[f.key] || []).includes(o) }"
              @click="toggleMulti(f, o)">{{ o }}</text>
          </view>

          <input v-else-if="f.type === 'number'" class="signup-input" type="number" v-model="signupData[f.key]" />
        </view>
        <view class="signup-actions">
          <view class="signup-btn cancel" @click="showSignupForm = false"><text>取消</text></view>
          <view class="signup-btn submit" @click="submitSignupForm"><text>确认报名</text></view>
        </view>
      </view>
    </view>

    <!-- 报名奖励引导弹层（微信环境 + 配置 rewardConfig） -->
    <view class="signup-mask" v-if="showGuide">
      <view class="signup-panel guide-panel" @click.stop>
        <text class="signup-title">报名奖励</text>

        <!-- Step1 登录方式 -->
        <template v-if="guideStep === 'login'">
          <text class="guide-tip">微信授权登录可解锁更多权益：模板消息通知报名进度 + 获得积分、专属福利。</text>
          <view class="guide-row">
            <view class="guide-opt" @click="chooseSilentLogin">
              <text class="guide-opt-title">静默登录</text>
              <text class="guide-opt-desc">直接报名，无额外权益</text>
            </view>
            <view class="guide-opt primary" @click="chooseAuthLogin">
              <text class="guide-opt-title">微信授权登录</text>
              <text class="guide-opt-desc">模板通知 · 积分 · 更多福利</text>
            </view>
          </view>
        </template>

        <!-- Step2 信息解锁 -->
        <template v-else-if="guideStep === 'info'">
          <text class="guide-tip">完善以下信息，可解锁对应奖励（选填，不强制）</text>
          <view v-for="f in formFields" :key="f.key" class="signup-field">
            <text class="signup-label">{{ f.label }}</text>
            <input v-if="f.type === 'text' || f.type === 'phone'" class="signup-input"
              v-model="signupData[f.key]" :type="f.type === 'phone' ? 'number' : 'text'"
              :placeholder="f.placeholder || ''" />
            <textarea v-else-if="f.type === 'textarea'" class="signup-textarea" v-model="signupData[f.key]" />
            <view v-else-if="f.type === 'radio'" class="signup-options">
              <text v-for="o in (f.options || [])" :key="o" class="signup-opt"
                :class="{ on: signupData[f.key] === o }" @click="signupData[f.key] = o">{{ o }}</text>
            </view>
            <picker v-else-if="f.type === 'select'" mode="selector" :range="(f.options || [])"
              @change="e => signupData[f.key] = (f.options || [])[Number(e.detail.value)]">
              <view class="signup-picker"><text>{{ signupData[f.key] || '请选择' }}</text><text class="picker-arrow">▼</text></view>
            </picker>
            <view v-else-if="f.type === 'multi'" class="signup-options">
              <text v-for="o in (f.options || [])" :key="o" class="signup-opt"
                :class="{ on: (signupData[f.key] || []).includes(o) }" @click="toggleMulti(f, o)">{{ o }}</text>
            </view>
            <input v-else-if="f.type === 'number'" class="signup-input" type="number" v-model="signupData[f.key]" />
          </view>
          <view class="guide-actions">
            <view class="signup-btn cancel" @click="showGuide = false"><text>取消</text></view>
            <view class="signup-btn submit" @click="continueInfo"><text>下一步</text></view>
          </view>
        </template>

        <!-- Step3 奖励菜单 -->
        <template v-else-if="guideStep === 'reward'">
          <text class="guide-tip">以下奖励已解锁{{ multiRewards.length ? '，可多选' : '' }}</text>
          <view v-for="r in unlockedRewards" :key="r.id" class="signup-field reward-item"
            @click="toggleGuideReward(r)">
            <view class="reward-check" :class="{ on: chosenRewards.includes(r.id) }">
              <text v-if="r.mode !== 'multi'" class="reward-auto">自动</text>
              <text v-else>✓</text>
            </view>
            <text class="reward-name">{{ r.name }}</text>
          </view>
          <view class="guide-actions">
            <view class="signup-btn cancel" @click="showGuide = false"><text>取消</text></view>
            <view class="signup-btn submit" @click="confirmGuideSignup"><text>{{ multiRewards.length ? '确认并报名' : '直接报名' }}</text></view>
          </view>
        </template>

        <!-- Step4 确认报名 -->
        <template v-else-if="guideStep === 'confirm'">
          <text class="guide-tip">确认报名后，系统将自动发放以下奖励：</text>
          <view v-for="g in unwrapGrantedPreview" :key="g.id" class="signup-field reward-item">
            <text class="reward-name">{{ g.name }}</text>
          </view>
          <view class="guide-actions">
            <view class="signup-btn cancel" @click="showGuide = false"><text>取消</text></view>
            <view class="signup-btn submit" @click="confirmGuideSignup"><text>确认报名</text></view>
          </view>
        </template>
      </view>
    </view>

    <!-- 微信二维码弹层 -->
    <view class="signup-mask" v-if="showWechat" @click="showWechat = false">
      <view class="signup-panel wechat-panel" @click.stop>
        <text class="signup-title">添加微信</text>
        <image v-if="wechatQrcode" :src="wechatQrcode" class="wechat-qrcode" mode="aspectFit" />
        <text v-else class="wechat-empty">未配置微信二维码</text>
        <view class="guide-actions">
          <view class="signup-btn cancel" @click="showWechat = false"><text>取消</text></view>
          <view v-if="wechatId" class="signup-btn submit" @click="copyWechat"><text>复制微信号</text></view>
        </view>
      </view>
    </view>

    <!-- 名片弹层 -->
    <view class="signup-mask" v-if="showCard" @click="showCard = false">
      <view class="signup-panel" @click.stop>
        <text class="signup-title">名片</text>
        <view class="card-top">
          <image v-if="cardAvatar" :src="cardAvatar" class="card-avatar" mode="aspectFill" />
          <view v-else class="card-avatar card-avatar--placeholder">🪪</view>
          <view class="card-head">
            <text class="card-name">{{ card?.name || '—' }}</text>
            <text v-if="card?.title" class="card-title">{{ card.title }}</text>
            <text v-if="card?.company" class="card-company">{{ card.company }}</text>
          </view>
        </view>
        <view class="card-row"><text class="card-label">电话</text><text class="card-value">{{ card?.phone || '未提供' }}</text></view>
        <view class="card-row"><text class="card-label">微信</text><text class="card-value">{{ card?.wechat || '未提供' }}</text></view>
        <view class="card-actions">
          <view v-if="card?.phone" class="signup-btn submit" @click="callCard"><text>一键拨号</text></view>
          <view v-if="card?.wechat" class="signup-btn submit" @click="copyCardWechat"><text>复制微信号</text></view>
          <view class="signup-btn submit" @click="saveVCard"><text>保存到通讯录</text></view>
          <view class="signup-btn cancel" @click="showCard = false"><text>关闭</text></view>
        </view>
      </view>
    </view>

    <!-- 留言弹层 -->
    <view class="signup-mask" v-if="showMessagePanel" @click="showMessagePanel = false">
      <view class="signup-panel message-panel" @click.stop>
        <text class="signup-title">在线留言</text>
        <scroll-view scroll-y class="message-scroll">
          <view v-for="(m, index) in messages" :key="index" class="message-item">
            <text class="msg-content">{{ m.content }}</text>
            <view v-if="m.status === 'replied' && m.reply" class="msg-reply-box">
              <text class="msg-reply">{{ m.reply }}</text>
            </view>
            <text class="msg-time">{{ formatTime(m.createdAt) }}</text>
          </view>
          <view v-if="!messages.length" class="message-empty">暂无留言</view>
        </scroll-view>
        <view class="message-input-row">
          <input v-model="messageContent" class="message-input" placeholder="输入留言内容..." confirm-type="send" @confirm="sendMessage" />
          <view class="signup-btn submit message-send" @click="sendMessage"><text>发送</text></view>
        </view>
      </view>
    </view>

    <!-- 分享海报（复用通用 share-poster 组件） -->
    <share-poster
      :visible="showSharePoster"
      @close="showSharePoster = false"
      :config="posterConfig"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import {
  getPromoPage,
  sendActivityMessage,
  listMyActivityMessages,
  signupActivity,
  unlockCheck,
} from '../../services/api'
import { getToken } from '../../utils/storage'
import { getEnv, isWechatBrowser, resolveMediaUrl } from '../../utils/env'
import { redirectToWechatAuth } from '../../utils/wx-h5-login'
import SharePoster from '../../components/share-poster/share-poster.vue'
import PromoCover from '../../components/promo/promo-cover.vue'
import PromoInfo from '../../components/promo/promo-info.vue'
import PromoRich from '../../components/promo/promo-rich.vue'
import PromoHighlights from '../../components/promo/promo-highlights.vue'
import PromoSpeakers from '../../components/promo/promo-speakers.vue'
import PromoAgenda from '../../components/promo/promo-agenda.vue'
import PromoImages from '../../components/promo/promo-images.vue'
import PromoRewards from '../../components/promo/promo-rewards.vue'
import PromoContact from '../../components/promo/promo-contact.vue'
import PromoMessage from '../../components/promo/promo-message.vue'
import PromoFaq from '../../components/promo/promo-faq.vue'
import PromoCustom from '../../components/promo/promo-custom.vue'

/** 可渲染模块类型白名单（未知 type 不渲染） */
const PROMO_TYPE_SET = new Set([
  'cover',
  'info',
  'rich',
  'highlights',
  'speakers',
  'agenda',
  'images',
  'rewards',
  'contact',
  'message',
  'faq',
  'custom',
])

// 报名引导存储键（与 detail.vue 一致，微信授权跳转回调后恢复引导进度）
const REWARD_GUIDE_KEY = 'actRewardGuide'

const act = ref('')
const page = ref<any>(null)
const loading = ref(false)

const activity = computed(() => page.value?.activity || null)
const styleClass = computed(() => `promo-${page.value?.activity?.promoTemplate || 'summit'}`)
// 运营端可配置 promoColors 六色值，内联 CSS 变量覆盖模板默认配色（--c-*）
const colorVars = computed(() => {
  const c = page.value?.activity?.promoColors
  if (!c || typeof c !== 'object') return null
  const vars: Record<string, string> = {}
  if (c.primary) vars['--c-primary'] = c.primary
  if (c.accent) vars['--c-accent'] = c.accent
  if (c.bg) vars['--c-bg'] = c.bg
  if (c.card) vars['--c-card'] = c.card
  if (c.text) vars['--c-text'] = c.text
  if (c.textDim) vars['--c-text-dim'] = c.textDim
  return vars
})
const inWechat = computed(() => getEnv().type === 'wechat' || isWechatBrowser())
const modules = computed(() =>
  (page.value?.modules || [])
    .filter((m: any) => PROMO_TYPE_SET.has(m.type))
    .sort((a: any, b: any) => a.sort - b.sort)
)
const contact = computed(() => page.value?.contact || null)
const signupStatus = computed(() => page.value?.signupStatus || null)

// 报名状态
const formFields = computed(() => {
  const cfg = activity.value?.formConfig
  return Array.isArray(cfg) ? cfg : []
})
const rewardCfg = computed(() => {
  const rc = activity.value?.rewardConfig
  return rc && typeof rc === 'object' ? rc : null
})
const signupBtnText = computed(() => {
  const s = signupStatus.value
  if (s?.signedUp) {
    return s.status === 'waiting' ? '候补中' : '已报名 · 查看凭证'
  }
  const st = activity.value?.status
  if (st === 'draft') return '活动未发布'
  if (st === 'ended' || st === 'archived') return '活动已结束'
  return '立即报名'
})

// 留言
const messages = ref<any[]>([])
const messageContent = ref('')
const messageSending = ref(false)

async function loadMessages() {
  if (!act.value) return
  try {
    messages.value = (await listMyActivityMessages(act.value)) || []
  } catch (e) {
    messages.value = []
  }
}

// ===== 页面数据加载 =====
async function loadPage() {
  if (!act.value) return
  loading.value = true
  try {
    const res = await getPromoPage(act.value)
    page.value = res ?? null
    uni.setNavigationBarTitle({ title: res?.activity?.title || '活动宣传' })
    if (res?.signupStatus?.signedUp) loadMessages()
  } catch (e) {
    page.value = null
  } finally {
    loading.value = false
  }
}

// ===== 报名奖励引导（微信环境 + rewardConfig，复刻 detail.vue） =====
const showGuide = ref(false)
const guideStep = ref<'login' | 'info' | 'reward' | 'confirm' | ''>('')
const loginAuth = ref(false)
const chosenRewards = ref<string[]>([])
// v2 递进式领取：问卷数据 / 关注状态 / 后端解锁探测
const questionnaireData = ref<Record<string, any>>({})
const subscribed = ref(false)
const unlockStatus = ref<any>(null)

/** 解锁通道归一化：channel.type 优先，兼容旧 infoChannels（contact/survey 直映，其余默认 contact） */
const channelType = computed(() => {
  const ch = rewardCfg.value?.channel?.type
  if (ch) return ch
  const legacy = (Array.isArray(rewardCfg.value?.infoChannels) ? rewardCfg.value.infoChannels : [])[0]?.channel
  return legacy === 'survey' ? 'survey' : 'contact'
})

/** 是否已填问卷（questionnaireData 至少一个字段有值） */
function surveyFilledValue(): boolean {
  const d = questionnaireData.value
  if (!d || typeof d !== 'object') return false
  return Object.keys(d).some((k: string) => {
    const v = d[k]
    if (v === undefined || v === null) return false
    if (Array.isArray(v)) return v.length > 0
    return String(v).trim() !== ''
  })
}

/** 通道/条件是否达成：contact=报名表单电话必填已填；survey=问卷已填；wechat_auth/subscribe 由后端探测 */
function channelFilledValue(channel: string): boolean {
  if (channel === 'survey') return surveyFilledValue()
  if (channel === 'contact') {
    const fields = Array.isArray(activity.value?.formConfig) ? activity.value.formConfig : []
    const phoneFields = fields.filter((f: any) => f?.type === 'phone' && f?.key)
    if (!phoneFields.length) return false
    return phoneFields.some((f: any) => {
      const v = signupData.value[f.key]
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    })
  }
  return false
}

/** 通道门槛：单选四选一，是否已达成 */
const channelDone = computed(() => {
  const t = channelType.value
  if (t === 'contact') return channelFilledValue('contact')
  if (t === 'survey') return surveyFilledValue()
  if (t === 'wechat_auth') return loginAuth.value
  if (t === 'subscribe') return subscribed.value
  return true
})

/** 当前用户已解锁的奖励（先过通道门槛 channelDone，再按各权益独立 condition 判定） */
const unlockedRewards = computed(() => {
  const rws = Array.isArray(rewardCfg.value?.rewards) ? rewardCfg.value.rewards : []
  if (!channelDone.value) return []
  return rws.filter((r: any) => {
    if (!r?.id) return false
    const c = r.condition || (r.loginRequired ? 'wechat_auth' : (r.channel || 'none'))
    if (c === 'wechat_auth') return loginAuth.value
    if (c === 'subscribe') return subscribed.value
    if (c === 'contact' || c === 'survey') return channelFilledValue(c)
    return true
  })
})

const multiRewards = computed(() => unlockedRewards.value.filter((r: any) => r.mode === 'multi'))

/** 进入引导：仅微信环境且该活动配置了 rewardConfig；先探测解锁状态再定步进 */
async function openRewardGuide() {
  loginAuth.value = false
  subscribed.value = false
  chosenRewards.value = []
  unlockStatus.value = null
  showGuide.value = true
  // 若存在引导进度（微信授权回调后恢复），则已选授权登录
  const pending = uni.getStorageSync(REWARD_GUIDE_KEY) as any
  if (pending?.activityId === act.value) {
    loginAuth.value = !!pending.loginAuth
    uni.removeStorageSync(REWARD_GUIDE_KEY)
  }
  await refreshUnlockStatus()
  guideStep.value = resolveGuideStep()
}

/** 调用后端解锁探测，刷新 loginAuth/subscribed/unlockStatus */
async function refreshUnlockStatus() {
  try {
    const st = await unlockCheck(act.value, { ...signupData.value }, questionnaireData.value)
    unlockStatus.value = st || null
    loginAuth.value = !!st?.loginAuth
    subscribed.value = !!st?.subscribed
  } catch (e) {
    unlockStatus.value = null
  }
}

/** 按通道与达成情况决定引导步进 */
function resolveGuideStep(): string {
  if (channelType.value === 'wechat_auth' && !loginAuth.value) return 'login'
  if (!channelDone.value) return 'info'
  return 'reward'
}

/** 静默/跳过：不完成通道直接报名（未过通道门槛则无可领权益） */
function chooseSilentLogin() {
  loginAuth.value = false
  guideStep.value = 'reward'
}

function chooseAuthLogin() {
  // 微信授权登录：跳转 snsapi_userinfo 获取头像昵称；回调后恢复引导
  uni.setStorageSync(REWARD_GUIDE_KEY, { activityId: act.value, loginAuth: true })
  redirectToWechatAuth('snsapi_userinfo').catch(() => {
    uni.removeStorageSync(REWARD_GUIDE_KEY)
  })
}

/** 信息步进完成：重新评估通道是否达成 */
function continueInfo() {
  guideStep.value = channelDone.value ? 'reward' : 'info'
}

/** 勾选/取消多选奖励（单选自动领取，不可取消；按 selectMode 约束） */
function toggleGuideReward(r: any) {
  if (r.mode !== 'multi') return
  const mode = unlockStatus.value?.selectMode || 'all'
  const n = Math.max(1, Number(unlockStatus.value?.selectN) || 1)
  const i = chosenRewards.value.indexOf(r.id)
  if (i >= 0) chosenRewards.value.splice(i, 1)
  else if (mode === 'one') chosenRewards.value = [r.id]
  else if (mode === 'any') { if (chosenRewards.value.length < n) chosenRewards.value.push(r.id) }
  else chosenRewards.value.push(r.id)
}

/** 确认页预览：已选定（单选自动 + 多选已勾选）的奖励 */
const unwrapGrantedPreview = computed(() => {
  const singles = unlockedRewards.value.filter((r: any) => r.mode !== 'multi')
  const multi = unlockedRewards.value.filter((r: any) => r.mode === 'multi' && chosenRewards.value.includes(r.id))
  return [...singles, ...multi]
})

function confirmGuideSignup() {
  const formData = { ...signupData.value }
  showGuide.value = false
  doSignup(formData, chosenRewards.value, { ...questionnaireData.value })
}

/** 问卷字段（选填，仅用于 survey 通道判定） */
const questionnaireFields = computed(() => {
  const q = activity.value?.questionnaire
  return q && q.enabled === true && Array.isArray(q.fields) ? q.fields : []
})

/** 权益选择方式文案（reward 步进提示） */
const selectModeHint = computed(() => {
  const mode = unlockStatus.value?.selectMode || 'all'
  if (mode === 'one') return '单选'
  if (mode === 'any') return `任选最多 ${Math.max(1, Number(unlockStatus.value?.selectN) || 1)} 项`
  return '可多选'
})

// ===== 普通报名表单 =====
const showSignupForm = ref(false)
const signupData = ref<Record<string, any>>({})

function openSignupForm() {
  signupData.value = {}
  showSignupForm.value = true
}

function toggleMulti(f: any, o: string) {
  const arr = Array.isArray(signupData.value[f.key]) ? [...signupData.value[f.key]] : []
  const i = arr.indexOf(o)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(o)
  signupData.value[f.key] = arr
}

function validateSignupForm(): string {
  for (const f of formFields.value) {
    const v = signupData.value[f.key]
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    if (f.required && empty) return `请填写${f.label}`
    if (empty) continue
    if (f.type === 'phone' && !/^1[3-9]\d{9}$/.test(String(v))) return `请填写正确的${f.label}`
    if (f.type === 'number') {
      const n = Number(v)
      if (!Number.isFinite(n)) return `请填写正确的${f.label}`
      if (f.min != null && n < Number(f.min)) return `${f.label}不能小于${f.min}`
      if (f.max != null && n > Number(f.max)) return `${f.label}不能大于${f.max}`
    }
    if ((f.type === 'radio' || f.type === 'select') && !(f.options || []).includes(v)) return `请选择正确的${f.label}`
    if (f.type === 'multi') {
      const bad = (v || []).some((x: string) => !(f.options || []).includes(x))
      if (bad) return `请选择正确的${f.label}`
    }
  }
  return ''
}

function submitSignupForm() {
  const err = validateSignupForm()
  if (err) { uni.showToast({ title: err, icon: 'none' }); return }
  const formData = { ...signupData.value }
  showSignupForm.value = false
  doSignup(formData)
}

function onSignup() {
  // 配置了奖励且处于微信环境 → 走分步引导；否则维持普通报名表单逻辑
  if (rewardCfg.value && inWechat.value) {
    openRewardGuide()
  } else if (formFields.value.length) {
    openSignupForm()
  } else {
    doSignup()
  }
}

async function doSignup(formData?: Record<string, any>, chosenRewardsArg: string[] = [], questionnaire?: Record<string, any>) {
  uni.showLoading({ title: '报名中...' })
  try {
    const result = await signupActivity(act.value, formData, chosenRewardsArg, questionnaire)
    if ((result as any)?.ok) {
      if ((result as any)?.waitlisted) {
        uni.hideLoading()
        uni.showToast({ title: `已加入候补 #${(result as any)?.position || ''}`, icon: 'none' })
        if (page.value) {
          page.value.signupStatus = { signedUp: true, status: 'waiting', signupId: (result as any)?.signupId ?? null }
        }
        return
      }
      uni.hideLoading()
      uni.showToast({ title: '报名成功', icon: 'success' })
      if (page.value) {
        page.value.signupStatus = { signedUp: true, status: 'active', signupId: (result as any)?.signupId ?? null }
      }
      // 引导下发奖励回显：逐个 toast
      const granted = (result as any)?.granted
      if (Array.isArray(granted) && granted.length) {
        setTimeout(() => granted.forEach((g: any, i: number) => {
          setTimeout(() => uni.showToast({ title: g.message || `已获得${g.name || ''}`, icon: 'none', duration: 2000 }), i * 2200)
        }), 800)
      }
      loadMessages()
    } else {
      uni.hideLoading()
      if ((result as any)?.reason === 'already_signed_up') {
        if (page.value) {
          page.value.signupStatus = { signedUp: true, status: 'active', signupId: (result as any)?.signupId ?? null }
        }
        uni.showToast({ title: '您已报名过', icon: 'none' })
        loadMessages()
      } else if ((result as any)?.reason === 'insufficient_points') {
        uni.showToast({ title: '积分不足，无法报名', icon: 'none' })
      } else {
        uni.showToast({ title: '报名失败', icon: 'none' })
      }
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '报名失败', icon: 'none' })
  }
}

// ===== 联系方式交互 =====
const showWechat = ref(false)
const showCard = ref(false)
const showMessagePanel = ref(false)

const wechatQrcode = computed(() => resolveMediaUrl(contact.value?.wechat?.qrcode))
const wechatId = computed(() => contact.value?.wechat?.id || '')
const card = computed(() => contact.value?.card || null)
const cardAvatar = computed(() => resolveMediaUrl(card.value?.avatar))

function openWechat() {
  if (!wechatQrcode.value && !wechatId.value) {
    uni.showToast({ title: '未配置微信联系方式', icon: 'none' })
    return
  }
  showWechat.value = true
}

function copyWechat() {
  if (!wechatId.value) return
  uni.setClipboardData({
    data: wechatId.value,
    success: () => uni.showToast({ title: '微信号已复制', icon: 'success' }),
  })
}

function callPhone() {
  const phone = contact.value?.phone
  if (!phone) {
    uni.showToast({ title: '未配置联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: phone })
}

function openCard() {
  if (!card.value) return
  showCard.value = true
}

function callCard() {
  if (card.value?.phone) uni.makePhoneCall({ phoneNumber: card.value.phone })
}

function copyCardWechat() {
  if (card.value?.wechat) {
    uni.setClipboardData({
      data: card.value.wechat,
      success: () => uni.showToast({ title: '微信号已复制', icon: 'success' }),
    })
  }
}

function saveVCard() {
  const c = card.value
  if (!c) return
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${c.name || ''}`,
    `TITLE:${c.title || ''}`,
    `ORG:${c.company || ''}`,
    `TEL;TYPE=CELL:${c.phone || ''}`,
    `X-WECHAT:${c.wechat || ''}`,
    'END:VCARD',
  ].join('\n')
  // #ifdef H5
  const link = document.createElement('a')
  link.href = `data:text/vcard;charset=utf-8,${encodeURIComponent(vcf)}`
  link.download = `${c.name || 'contact'}.vcf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  uni.showToast({ title: '已下载名片', icon: 'success' })
  // #endif
  // #ifndef H5
  uni.showModal({
    title: '保存到通讯录',
    content: '当前环境不支持直接保存名片，可复制名片信息手动添加',
    confirmText: '复制名片信息',
    success: (res) => {
      if (res.confirm) {
        uni.setClipboardData({
          data: vcf,
          success: () => uni.showToast({ title: '名片信息已复制', icon: 'success' }),
        })
      }
    },
  })
  // #endif
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN')
}

function openMessagePanel() {
  if (!getToken()) {
    uni.showModal({
      title: '提示',
      content: '登录后即可留言',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) uni.navigateTo({ url: '/pages/login/login' })
      },
    })
    return
  }
  showMessagePanel.value = true
  if (!messages.value.length) loadMessages()
}

async function sendMessage() {
  const content = messageContent.value.trim()
  if (!content) {
    uni.showToast({ title: '请输入留言内容', icon: 'none' })
    return
  }
  if (messageSending.value) return
  messageSending.value = true
  try {
    await sendActivityMessage(act.value, content)
    messageContent.value = ''
    uni.showToast({ title: '留言成功', icon: 'success' })
    await loadMessages()
  } catch (e) {
    uni.showToast({ title: '留言失败', icon: 'none' })
  } finally {
    messageSending.value = false
  }
}

// ===== 分享海报 =====
const showSharePoster = ref(false)
const posterConfig = computed(() => ({
  templateCode: 'activity_share',
  title: activity.value?.title,
  desc: activity.value?.description,
  pagePath: `pages/activity/promo?act=${act.value}`,
  variables: {
    title: activity.value?.title || '',
    desc: activity.value?.description || '',
  },
}))

onLoad((options) => {
  act.value = (options as any)?.act || ''
  loadPage()
})

let firstShow = true
onShow(() => {
  // 首次 onShow 紧跟 onLoad，已加载，跳过避免重复拉取
  if (firstShow) {
    firstShow = false
    return
  }
  // 从登录/授权等页面返回时静默刷新聚合数据（保留现有内容）
  if (act.value && page.value) loadPage()
  if (activity.value) setupPromoShare()
})

onShareAppMessage(() => ({
  title: activity.value?.title || '活动宣传',
  path: `/pages/activity/promo?act=${act.value}`,
}))

onShareTimeline(() => ({
  title: activity.value?.title || '活动宣传',
  query: `act=${act.value}`,
}))
</script>

<style lang="scss" scoped>
.promo-page {
  background: var(--c-bg);
  color: var(--c-text);
  min-height: 100vh;
  padding-bottom: 180rpx;
}

.promo-share-btn {
  position: fixed;
  top: 24rpx;
  right: 24rpx;
  z-index: 50;
  padding: 12rpx 28rpx;
  border-radius: 32rpx;
  background: var(--c-primary);
  color: #fff;
  font-size: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
}

.promo-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: var(--c-bg);
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.promo-btn-primary {
  padding: 24rpx 0;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  text-align: center;
}

.promo-state {
  padding: 120rpx 30rpx;
  text-align: center;
  font-size: 28rpx;
  color: var(--c-text-dim);
}
.promo-state--retry {
  text-decoration: underline;
}

/* 弹层通用（底部抽屉） */
.signup-mask { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 99; display: flex; align-items: flex-end; justify-content: center; }
.signup-panel { width: 100%; max-height: 78vh; overflow-y: auto; background: #fff; border-radius: 24rpx 24rpx 0 0; padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom)); }
.signup-title { font-size: 32rpx; font-weight: 600; color: #333; margin-bottom: 24rpx; }
.signup-field { margin-bottom: 28rpx; }
.signup-label { display: block; font-size: 26rpx; color: #333; margin-bottom: 12rpx; }
.req { color: #ff4d4f; margin-left: 4rpx; }
.signup-input { border: 1rpx solid #e5e5e5; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.signup-textarea { width: 100%; box-sizing: border-box; min-height: 140rpx; border: 1rpx solid #e5e5e5; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.signup-picker { border: 1rpx solid #e5e5e5; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; color: #333; display: flex; justify-content: space-between; }
.picker-arrow { font-size: 22rpx; color: #999; }
.signup-options { display: flex; flex-wrap: wrap; gap: 16rpx; }
.signup-opt { font-size: 26rpx; color: #666; padding: 10rpx 28rpx; border: 1rpx solid #ddd; border-radius: 28rpx; }
.signup-opt.on { color: #667eea; border-color: #667eea; background: rgba(102,126,234,.08); }
.signup-actions { display: flex; gap: 20rpx; margin-top: 32rpx; }
.signup-btn { flex: 1; text-align: center; padding: 22rpx 0; border-radius: 40rpx; font-size: 30rpx; }
.signup-btn.cancel { background: #f5f5f5; color: #666; }
.signup-btn.submit { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }

/* 报名奖励引导 */
.guide-panel { padding-bottom: calc(32rpx + env(safe-area-inset-bottom)); }
.guide-tip { display: block; font-size: 26rpx; color: #666; line-height: 1.6; margin-bottom: 24rpx; }
.guide-row { display: flex; gap: 20rpx; }
.guide-opt { flex: 1; border: 1rpx solid #e0e0e0; border-radius: 16rpx; padding: 28rpx 20rpx; display: flex; flex-direction: column; gap: 8rpx; }
.guide-opt.primary { border-color: #667eea; background: rgba(102,126,234,.06); }
.guide-opt-title { font-size: 30rpx; font-weight: 600; color: #333; }
.guide-opt-desc { font-size: 22rpx; color: #999; }
.guide-actions { display: flex; gap: 20rpx; margin-top: 32rpx; }
.reward-item { display: flex; align-items: center; gap: 20rpx; padding: 20rpx; border: 1rpx solid #eee; border-radius: 12rpx; margin-bottom: 16rpx; }
.reward-check { width: 40rpx; height: 40rpx; border-radius: 8rpx; border: 1rpx solid #ccc; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
.reward-check.on { background: #667eea; border-color: #667eea; }
.reward-auto { font-size: 20rpx; color: #fff; }
.reward-name { flex: 1; font-size: 28rpx; color: #333; }

/* 微信二维码 */
.wechat-panel { display: flex; flex-direction: column; align-items: center; }
.wechat-qrcode { width: 400rpx; height: 400rpx; border-radius: 12rpx; background: #fafafa; }
.wechat-empty { padding: 80rpx 0; font-size: 26rpx; color: #999; }
.wechat-panel .guide-actions { width: 100%; }

/* 名片 */
.card-top { display: flex; align-items: center; gap: 20rpx; margin-bottom: 20rpx; }
.card-avatar { width: 120rpx; height: 120rpx; border-radius: 16rpx; background: #f5f5f5; }
.card-avatar--placeholder { display: flex; align-items: center; justify-content: center; font-size: 60rpx; }
.card-head { flex: 1; min-width: 0; }
.card-name { display: block; font-size: 32rpx; font-weight: 600; color: #333; }
.card-title { display: block; font-size: 26rpx; color: #666; margin-top: 6rpx; }
.card-company { display: block; font-size: 24rpx; color: #999; margin-top: 4rpx; }
.card-row { display: flex; padding: 12rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.card-label { width: 120rpx; font-size: 26rpx; color: #999; }
.card-value { flex: 1; font-size: 26rpx; color: #333; }
.card-actions { display: flex; flex-wrap: wrap; gap: 20rpx; margin-top: 24rpx; }
.card-actions .signup-btn { flex: 1 1 40%; min-width: 200rpx; }

/* 留言 */
.message-panel { display: flex; flex-direction: column; height: 60vh; }
.message-scroll { flex: 1; overflow: hidden; }
.message-item { padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.msg-content { display: block; font-size: 27rpx; color: #333; line-height: 1.6; }
.msg-reply-box { margin-top: 10rpx; padding: 12rpx 16rpx; border-radius: 12rpx; background: #f6f6f6; }
.msg-reply { display: block; font-size: 25rpx; color: #667eea; line-height: 1.6; }
.msg-time { display: block; margin-top: 8rpx; font-size: 22rpx; color: #999; }
.message-empty { padding: 60rpx 0; text-align: center; font-size: 26rpx; color: #999; }
.message-input-row { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; }
.message-input { flex: 1; border: 1rpx solid #e5e5e5; border-radius: 40rpx; padding: 18rpx 24rpx; font-size: 28rpx; }
.message-send { flex: none; width: 160rpx; padding: 18rpx 0; }
</style>
