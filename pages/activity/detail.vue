<template>
  <view class="page-container">
    <view v-if="activity" class="detail-wrap">
      <view class="card">
        <view class="card-head">
          <view class="head-main">
            <view v-if="seriesInfo" class="series-chip" @click="goSeries">
              <text class="series-chip-text">系列 · {{ seriesInfo.title }}</text>
              <text class="series-chip-arrow">›</text>
            </view>
            <text class="title">{{ activity.title }}</text>
          </view>
          <view v-if="activity.status" :class="['status-tag', `status-${activity.status}`]">
            <text>{{ statusText(activity.status) }}</text>
          </view>
          <view v-if="activity.archived" class="archived-tag">已归档</view>
        </view>

        <view class="info-row">
          <text class="info-label">时间</text>
          <text class="info-value">{{ formatTime(activity.startTime) }} ~ {{ formatTime(activity.endTime) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">场地</text>
          <text class="info-value">{{ activity.venueName || '待定场地' }}</text>
        </view>
        <view v-if="activity.capacity" class="info-row">
          <text class="info-label">名额</text>
          <text class="info-value">{{ usedCapacity }}/{{ activity.capacity }} 已报名</text>
        </view>
        <view v-if="fee.cost > 0" class="info-row">
          <text class="info-label">费用</text>
          <text class="info-value">
            现价 {{ fee.cost }} 积分
            <template v-if="fee.mode === 'tier' && fee.name">（档位 {{ fee.name }}）</template>
            <template v-else-if="fee.mode === 'factor'">（基础 {{ fee.base }}）</template>
          </text>
        </view>

        <view v-if="activity.description" class="desc">
          <text class="desc-title">活动介绍</text>
          <text class="desc-content">{{ activity.description }}</text>
        </view>
      </view>

      <!-- 宣传文案（运营端 promoModules，复用 promo 组件与主题配色） -->
      <view v-if="modules.length" class="promo-page promo-section" :class="promoClass" :style="colorVars">
        <block v-for="m in modules" :key="m.sort">
          <PromoCover v-if="m.type === 'cover'" :activity="activity" :config="m.config" />
          <PromoInfo v-else-if="m.type === 'info'" :activity="activity" :config="m.config" />
          <PromoRich v-else-if="m.type === 'rich'" :activity="activity" :config="m.config" />
          <PromoHighlights v-else-if="m.type === 'highlights'" :activity="activity" :config="m.config" />
          <PromoSpeakers v-else-if="m.type === 'speakers'" :activity="activity" :config="m.config" />
          <PromoAgenda v-else-if="m.type === 'agenda'" :activity="activity" :config="m.config" />
          <PromoImages v-else-if="m.type === 'images'" :activity="activity" :config="m.config" />
          <PromoFaq v-else-if="m.type === 'faq'" :activity="activity" :config="m.config" />
          <PromoCustom v-else-if="m.type === 'custom'" :activity="activity" :config="m.config" />
          <PromoRewards v-else-if="m.type === 'rewards'" :rewards="activity.rewardConfig" />
          <PromoContact
            v-else-if="m.type === 'contact'"
            :contact="activity.promoContact"
            @open-wechat="onPromoContact('wechat')"
            @call-phone="onPromoContact('phone')"
            @open-card="onPromoContact('card')"
            @open-message="onPromoContact('message')"
          />
          <PromoMessage v-else-if="m.type === 'message'" :messages="[]" @open-message="onPromoContact('message')" />
        </block>
      </view>

      <!-- 回放与资料（活动结束后的沉淀内容） -->
      <view v-if="hasAssets" class="card assets-card">
        <text class="assets-title">回放与资料</text>
        <view v-if="assets.recordingUrl" class="assets-item" @click="openRecording">
          <text class="assets-icon">▶</text>
          <text class="assets-name">活动回放</text>
          <text class="assets-arrow">›</text>
        </view>
        <view
          v-for="m in assets.materials"
          :key="m.name + m.url"
          class="assets-item"
          @click="openMaterial(m)"
        >
          <text class="assets-icon">📄</text>
          <text class="assets-name">{{ m.name }}</text>
          <text class="assets-arrow">›</text>
        </view>
      </view>

      <!-- 学员评价（公开聚合 + 列表，有评价才展示） -->
      <view v-if="reviewSummary.count > 0" class="card reviews-card">
        <view class="reviews-head">
          <text class="reviews-title">学员评价</text>
          <view class="reviews-score">
            <text class="reviews-score-num">{{ reviewSummary.avgRating }}</text>
            <text class="reviews-score-sub">/5 · {{ reviewSummary.count }} 条</text>
          </view>
        </view>
        <view v-for="r in reviews" :key="r.id" class="review-item">
          <view class="review-item-top">
            <text class="review-stars">{{ starText(r.rating) }}</text>
            <text class="review-user">{{ r.user?.nickname || r.user?.username || '学员' }}</text>
            <text class="review-time">{{ shortDate(r.reviewedAt) }}</text>
          </view>
          <text v-if="r.review" class="review-text">{{ r.review }}</text>
        </view>
      </view>

      <!-- 学习资料包（已解锁内容，签到后含学习包） -->
      <view v-if="learningContent && (learningContent.articles.length || learningContent.lessons.length || learningContent.courses.length)" class="card learn-card">
        <text class="learn-title">学习资料包</text>
        <view v-for="a in learningContent.articles" :key="'a' + a.documentId" class="learn-item" @click="openLearnArticle(a)">
          <text class="learn-icon">📄</text>
          <text class="learn-name">{{ a.title }}</text>
          <text class="learn-arrow">›</text>
        </view>
        <view v-for="l in learningContent.lessons" :key="'l' + l.documentId" class="learn-item" @click="openLearnLesson(l)">
          <text class="learn-icon">▶</text>
          <text class="learn-name">{{ l.title }}</text>
          <text class="learn-arrow">›</text>
        </view>
        <view v-for="c in learningContent.courses" :key="'c' + c.documentId" class="learn-item" @click="goCourse(c)">
          <text class="learn-icon">🎓</text>
          <text class="learn-name">{{ c.title }}</text>
          <text class="learn-arrow">›</text>
        </view>
      </view>

      <!-- 下次活动推荐（已结束：同系列/同类可报名场次） -->
      <view v-if="relatedActivities.length" class="card related-card">
        <text class="related-title">下次活动推荐</text>
        <view v-for="ra in relatedActivities" :key="ra.documentId" class="related-item" @click="goDetail(ra)">
          <view class="related-main">
            <text class="related-name">{{ ra.title }}</text>
            <text class="related-time">{{ formatTime(ra.startTime) }}</text>
          </view>
          <view class="related-cta"><text>{{ ra.status === 'signup_open' ? '报名' : '查看' }}</text></view>
        </view>
      </view>

      <!-- 分享海报入口 -->
      <view class="share-entry" @click="showSharePoster = true">
        <text>分享海报</text>
      </view>

      <!-- 报名成功后的到场二维码（worker_scan 模式） -->
      <view v-if="signedUp && canWorkerScan" class="card qr-card">
        <text class="qr-title">到场二维码</text>
        <text class="qr-tip">请向现场工作人员出示此二维码核销</text>
        <view class="qr-box">
          <image v-if="qrcodeUrl" :src="qrcodeUrl" class="qr-img" mode="aspectFit" />
          <text v-else class="qr-placeholder">二维码生成中...</text>
        </view>
      </view>

      <!-- 操作区 -->
      <view v-if="!signedUp && !waitlisted && activity.status === 'signup_open'" class="action-bar">
        <view class="action-btn primary" @click="onSignup">
          <text>{{ isFull ? '立即候补' : (fee.cost > 0 ? `报名 · ${fee.cost} 积分` : '立即报名') }}</text>
        </view>
      </view>

      <view v-else-if="waitlisted" class="action-bar">
        <view class="action-btn waiting"><text>候补中 #{{ waitlistPosition }}</text></view>
        <view class="action-btn normal" @click="onCancel"><text>取消候补</text></view>
      </view>

      <view v-if="signedUp" class="action-bar">
        <view v-if="canSignin" class="action-btn primary" @click="onCheckin">
          <text>到场签到</text>
        </view>
        <view v-if="canCancel" class="action-btn ghost" @click="onCancel">
          <text>取消报名</text>
        </view>
        <view v-if="activity.status === 'ended'" :class="['action-btn', reviewBtnClass]" @click="openReview">
          <text>{{ reviewed ? '已评价' : '去评价' }}</text>
        </view>
      </view>
    </view>

    <view v-if="!activity && loading" class="loading-state"><text>加载中...</text></view>
    <view v-if="!activity && !loading" class="loading-state"><text>活动不存在或已下架</text></view>

    <!-- 报名信息弹层 -->
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

    <!-- 报名奖励引导弹层（微信环境必走：对比法登录 + 分级积分 + 关注引导） -->
    <view class="signup-mask" v-if="showGuide">
      <view class="signup-panel guide-panel" @click.stop>
        <text class="signup-title">报名奖励</text>

        <!-- Step1 登录方式（对比法：授权突出，静默弱化） -->
        <template v-if="guideStep === 'login'">
          <text class="guide-tip">微信授权登录可解锁更多权益：模板消息通知报名进度 + 更高积分、专属福利。</text>
          <view class="guide-row">
            <view class="guide-opt primary highlight" @click="chooseAuthLogin">
              <text class="guide-opt-title">微信授权登录</text>
              <text class="guide-opt-desc">积分 +10 · 模板通知报名进度/候补转正</text>
              <view class="guide-benefits">
                <text class="guide-benefit">✓ 关注公众号自动同步</text>
                <text class="guide-benefit">✓ 头像昵称一键同步</text>
              </view>
              <view class="guide-btn auth">微信授权登录</view>
            </view>
            <view class="guide-opt muted" @click="chooseSilentLogin">
              <text class="guide-opt-title muted-title">静默登录</text>
              <text class="guide-opt-desc">直接报名，基础 5 积分</text>
            </view>
          </view>
        </template>

        <!-- Step2 信息完善（联系方式+20 / 问卷+50，选填） -->
        <template v-else-if="guideStep === 'info'">
          <text class="guide-tip">完善以下信息可获额外积分（选填）：联系方式 +20 · 问卷 +50</text>
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
          <view v-if="questionnaireFields.length" class="survey-entry" @click="openFillQuestionnaire">
            <text class="survey-entry-text">填写问卷（+50 积分）</text>
            <text class="survey-entry-arrow">›</text>
          </view>
          <view class="guide-actions">
            <view class="signup-btn cancel" @click="showGuide = false"><text>取消</text></view>
            <view class="signup-btn submit" @click="continueInfo"><text>下一步</text></view>
          </view>
        </template>

        <!-- Step3 关注公众号（+50 积分） -->
        <template v-else-if="guideStep === 'follow'">
          <text class="guide-tip">关注公众号额外获得 50 积分，并可接收活动提醒</text>
          <view class="qrcode-container">
            <image v-if="wxQrcodeUrl" :src="wxQrcodeUrl" class="qrcode-img" mode="aspectFit" />
            <text v-else class="qrcode-placeholder">公众号二维码加载中...</text>
          </view>
          <text class="qrcode-hint">长按识别二维码关注公众号</text>
          <view class="guide-actions">
            <view class="signup-btn cancel" @click="showGuide = false"><text>跳过</text></view>
            <view class="signup-btn submit" @click="refreshSubscribeStatus"><text>我已关注，刷新</text></view>
          </view>
        </template>

        <!-- Step4 奖励菜单（有 rewardConfig 才展示） -->
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

        <!-- Step5 确认报名（积分明细 + 权益） -->
        <template v-else-if="guideStep === 'confirm'">
          <text class="guide-tip">确认报名后，将获得以下积分：</text>
          <view class="points-preview">
            <view v-for="item in pointsPreviewList" :key="item.key" class="points-item">
              <text class="points-item-name">{{ item.name }}</text>
              <text class="points-item-val">+{{ item.points }}</text>
            </view>
          </view>
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

    <!-- 分享海报（复用通用 share-poster 组件） -->
    <share-poster
      :visible="showSharePoster"
      @close="showSharePoster = false"
      :config="{
        templateCode: 'activity_share',
        title: activity?.title,
        desc: activity?.description,
        pagePath: `pages/activity/detail?id=${id}`,
        variables: {
          title: activity?.title || '',
          activity_time: activity?.startTime
            ? `活动时间 · ${formatTime(activity.startTime)} ~ ${formatTime(activity.endTime)}`
            : '活动时间 · 待定',
          activity_venue: activity?.venueName ? `活动场所 · ${activity.venueName}` : '活动场所 · 待定'
        }
      }"
    />

    <!-- 评价弹层 -->
    <view class="review-mask" v-if="showReview" @click="showReview = false">
      <view class="review-panel" @click.stop>
        <text class="review-title">评价本次活动</text>

        <text class="review-field-label">评分</text>
        <view class="star-row">
          <text
            v-for="n in 5"
            :key="n"
            class="star"
            :class="{ active: n <= reviewRating }"
            @click="reviewRating = n"
          >★</text>
          <text class="star-value">{{ reviewRating ? reviewRating + ' 分' : '请选择' }}</text>
        </view>

        <text class="review-field-label">NPS 推荐度（0-10）</text>
        <view class="nps-row">
          <text
            v-for="n in 11"
            :key="n"
            class="nps-num"
            :class="{ active: reviewNps === n - 1 }"
            @click="reviewNps = n - 1"
          >{{ n - 1 }}</text>
        </view>

        <text class="review-field-label">评价内容</text>
        <textarea
          class="review-textarea"
          v-model="reviewText"
          placeholder="说说本次活动的体验..."
          placeholder-class="textarea-placeholder"
          :maxlength="500"
        />

        <view class="review-actions">
          <view class="review-btn cancel" @click="showReview = false"><text>取消</text></view>
          <view class="review-btn submit" @click="submitReview"><text>确认</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getActivityDetail,
  signupActivity,
  fillQuestionnaire,
  unlockCheck,
  getActivityFollowQrcode,
  cancelActivity,
  checkinActivity,
  myActivities,
  submitActivityReview,
  getUserInfo,
  getActivityFee,
  getActivityReviews,
  getMyActivityLearning,
  getSeries,
  listActivities,
} from '../../services/api'
import { getToken, getUser } from '../../utils/storage'
import { isWechatBrowser, resolveMediaUrl } from '../../utils/env'
import { setupPageShare } from '../../utils/share'
import { redirectToWechatAuth } from '../../utils/wx-h5-login'
import UQRCode from 'uqrcodejs'
import SharePoster from '../../components/share-poster/share-poster.vue'

// 宣传模块（复用 promo 组件，渲染运营端保存的 promoModules）
import PromoCover from '../../components/promo/promo-cover.vue'
import PromoInfo from '../../components/promo/promo-info.vue'
import PromoRich from '../../components/promo/promo-rich.vue'
import PromoHighlights from '../../components/promo/promo-highlights.vue'
import PromoSpeakers from '../../components/promo/promo-speakers.vue'
import PromoAgenda from '../../components/promo/promo-agenda.vue'
import PromoImages from '../../components/promo/promo-images.vue'
import PromoFaq from '../../components/promo/promo-faq.vue'
import PromoCustom from '../../components/promo/promo-custom.vue'
import PromoRewards from '../../components/promo/promo-rewards.vue'
import PromoContact from '../../components/promo/promo-contact.vue'
import PromoMessage from '../../components/promo/promo-message.vue'

// 报名引导存储键：activityId → { loginAuth }，用于微信授权跳转回调后恢复引导进度
const REWARD_GUIDE_KEY = 'actRewardGuide'

let id = ''
const activity = ref<any>(null)
const loading = ref(false)
const fee = ref<{ mode: string; cost: number; feeCollectAt: string; name: string; base: number }>({
  mode: 'flat',
  cost: 0,
  feeCollectAt: 'signup',
  name: '',
  base: 0,
})
const signedUp = ref(false)
const waitlisted = ref(false)
const waitlistPosition = ref(0)
// 满员判定：仅当设置了名额（capacity>0）才参与比较，避免不限名额活动误显示「立即候补」
const isFull = computed(() => {
  const cap = Number(activity.value?.capacity) || 0
  return cap > 0 && (activity.value?.usedCapacity ?? 0) >= cap
})
const qrcodeUrl = ref('')
const showSharePoster = ref(false)
const showReview = ref(false)
const reviewRating = ref(0)
const reviewNps = ref<number | null>(null)
const reviewText = ref('')
const reviewed = ref(false)
const reviews = ref<any[]>([])
const reviewSummary = ref<{ count: number; avgRating: number; reviewCount: number }>({ count: 0, avgRating: 0, reviewCount: 0 })
const learningContent = ref<{ checkedIn: boolean; articles: any[]; lessons: any[]; courses: any[] } | null>(null)
const relatedActivities = ref<any[]>([])
const showSignupForm = ref(false)
const signupData = ref<Record<string, any>>({})

// ===== 报名奖励引导 =====
const showGuide = ref(false)
const guideStep = ref<'login' | 'info' | 'follow' | 'reward' | 'confirm' | ''>('')
const loginAuth = ref(false)
const chosenRewards = ref<string[]>([])
const grantMessages = ref<{ message: string; link?: string }[]>([])
// v2 递进式领取：问卷数据 / 关注状态 / 后端解锁探测 / 报名记录
const questionnaireData = ref<Record<string, any>>({})
const subscribed = ref(false)
const unlockStatus = ref<any>(null)
const signupId = ref<number | null>(null)
const showFillQuestionnaire = ref(false)
const showQuestionnaire = ref(false)
// 公众号关注二维码（微信环境报名引导 Step3；未配置公众号时 followEnabled=false 跳过）
const wxQrcodeUrl = ref('')
const followEnabled = ref(false)

const rewardCfg = computed(() => {
  const rc = activity.value?.rewardConfig
  return rc && typeof rc === 'object' ? rc : null
})

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
  const rewards = Array.isArray(rewardCfg.value?.rewards) ? rewardCfg.value.rewards : []
  if (!channelDone.value) return []
  return rewards.filter((r: any) => {
    if (!r?.id) return false
    // 附加条件归一化：condition 优先，兼容旧 loginRequired/channel
    const c = r.condition || (r.loginRequired ? 'wechat_auth' : (r.channel || 'none'))
    if (c === 'wechat_auth') return loginAuth.value
    if (c === 'subscribe') return subscribed.value
    if (c === 'contact' || c === 'survey') return channelFilledValue(c)
    return true // none 无条件
  })
})

const multiRewards = computed(() => unlockedRewards.value.filter((r: any) => r.mode === 'multi'))

// 分级积分预览：单一来源取后端 unlockCheck.pointsPreview；接口异常降级固定兜底值
const FALLBACK_POINTS = { base: 5, auth: 5, contact: 20, survey: 50, subscribe: 50 }
const pointsPreview = computed(() => {
  const p = unlockStatus.value?.pointsPreview
  if (p && typeof p === 'object' && typeof p.total === 'number') return p
  return { ...FALLBACK_POINTS, total: Object.values(FALLBACK_POINTS).reduce((a: number, b: number) => a + b, 0) }
})
const pointsPreviewList = computed(() => {
  const p = pointsPreview.value
  const items = [
    { key: 'base', name: '报名基础积分', points: p.base },
    { key: 'auth', name: '微信授权登录', points: p.auth },
    { key: 'contact', name: '完善联系方式', points: p.contact },
    { key: 'survey', name: '回答问卷', points: p.survey },
    { key: 'subscribe', name: '关注公众号', points: p.subscribe },
  ]
  return items.filter(i => Number(i.points) > 0)
})

// 信息步：有报名表单(电话)或问卷且对应项未填才需要
const hasPhoneField = computed(() => formFields.value.some((f: any) => f?.type === 'phone' && f?.key))
const needsInfo = computed(() => {
  const contactNeeded = hasPhoneField.value && !channelFilledValue('contact')
  const surveyNeeded = questionnaireFields.value.length > 0 && !surveyFilledValue()
  return contactNeeded || surveyNeeded
})

// 关注步：未关注且二维码可用才展示
const showFollowStep = computed(() => !subscribed.value && followEnabled.value)

/** 进入引导：微信环境无条件触发（不再依赖 rewardConfig）；先探测解锁状态再定步进 */
async function openRewardGuide() {
  loginAuth.value = false
  subscribed.value = false
  chosenRewards.value = []
  grantMessages.value = []
  unlockStatus.value = null
  wxQrcodeUrl.value = ''
  followEnabled.value = false
  showGuide.value = true
  // 若存在引导进度（微信授权回调后恢复），则已选授权登录
  const pending = uni.getStorageSync(REWARD_GUIDE_KEY) as any
  if (pending?.activityId === id) {
    loginAuth.value = !!pending.loginAuth
    uni.removeStorageSync(REWARD_GUIDE_KEY)
  }
  await refreshUnlockStatus()
  if (!subscribed.value) await loadFollowQrcode()
  guideStep.value = resolveGuideStep()
}

/** 调用后端解锁探测，刷新 loginAuth/subscribed/unlockStatus */
async function refreshUnlockStatus() {
  try {
    const st = await unlockCheck(id, { ...signupData.value }, questionnaireData.value)
    unlockStatus.value = st || null
    loginAuth.value = !!st?.loginAuth
    subscribed.value = !!st?.subscribed
  } catch (e) {
    unlockStatus.value = null
  }
}

/** 加载公众号关注二维码（失败/未配置 → followEnabled=false，跳过关注步不阻塞报名） */
async function loadFollowQrcode() {
  try {
    const res = await getActivityFollowQrcode(id)
    const url = (res as any)?.wx_url || (res as any)?.data?.wx_url || ''
    wxQrcodeUrl.value = url
    followEnabled.value = !!url
  } catch (e) {
    wxQrcodeUrl.value = ''
    followEnabled.value = false
  }
}

/** 线性向导下一步：login → info → follow → reward(有权益才展示) → confirm */
function resolveNextStep(): string {
  if (needsInfo.value) return 'info'
  if (showFollowStep.value) return 'follow'
  if (unlockedRewards.value.length) return 'reward'
  return 'confirm'
}
function resolveGuideStep(): string {
  if (!loginAuth.value) return 'login'
  return resolveNextStep()
}

/** 静默/跳过登录：跳过登录对比步，继续后续 info/follow/reward */
function chooseSilentLogin() {
  loginAuth.value = false
  guideStep.value = resolveNextStep()
}

function chooseAuthLogin() {
  // 微信授权登录：跳转 snsapi_userinfo 获取头像昵称；回调用恢复引导
  uni.setStorageSync(REWARD_GUIDE_KEY, { activityId: id, loginAuth: true })
  redirectToWechatAuth('snsapi_userinfo').catch(() => {
    uni.removeStorageSync(REWARD_GUIDE_KEY)
  })
}

/** 信息步进完成：重新评估下一步（可能仍需 info） */
function continueInfo() {
  guideStep.value = resolveNextStep()
}

/** 关注公众号通道：重测订阅状态（微信事件回调已写库，刷新即可）；已关注则发关注积分并推进 */
async function refreshSubscribeStatus() {
  await refreshUnlockStatus()
  if (subscribed.value) {
    guideStep.value = resolveNextStep()
    uni.showToast({ title: '已关注，+50积分', icon: 'none' })
  } else {
    uni.showToast({ title: '暂未检测到关注，请关注后再试', icon: 'none' })
  }
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

const formFields = computed(() => {
  const cfg = activity.value?.formConfig
  return Array.isArray(cfg) ? cfg : []
})

// ---- 问卷（选填；补填可解锁 survey 条件权益） ----
const questionnaireFields = computed(() => {
  const q = activity.value?.questionnaire
  return q && q.enabled === true && Array.isArray(q.fields) ? q.fields : []
})

/** 报名成功后是否展示「补填问卷解锁权益」入口（有 survey 条件权益且未填问卷） */
const showFillQuestionnaireBtn = computed(() => {
  if (!signedUp.value || !signupId.value) return false
  if (!questionnaireFields.value.length) return false
  const rewards = Array.isArray(rewardCfg.value?.rewards) ? rewardCfg.value.rewards : []
  return rewards.some((r: any) => {
    const c = r.condition || (r.loginRequired ? 'wechat_auth' : (r.channel || 'none'))
    return c === 'survey' && !surveyFilledValue()
  })
})

/** 权益选择方式文案（reward 步进提示） */
const selectModeHint = computed(() => {
  const mode = unlockStatus.value?.selectMode || 'all'
  if (mode === 'one') return '单选'
  if (mode === 'any') return `任选最多 ${Math.max(1, Number(unlockStatus.value?.selectN) || 1)} 项`
  return '可多选'
})

function toggleQuestionnaireMulti(f: any, o: string) {
  const arr = Array.isArray(questionnaireData.value[f.key]) ? [...questionnaireData.value[f.key]] : []
  const i = arr.indexOf(o)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(o)
  questionnaireData.value[f.key] = arr
}

function openFillQuestionnaire() {
  showQuestionnaire.value = true
}

/** 补填问卷：提交后重算解锁并幂等发放新增 multi 权益 */
async function submitFillQuestionnaire() {
  if (!signupId.value) return
  uni.showLoading({ title: '提交中...' })
  try {
    const res = await fillQuestionnaire(signupId.value, { ...questionnaireData.value })
    uni.hideLoading()
    if ((res as any)?.ok) {
      showQuestionnaire.value = false
      const newly = (res as any)?.newlyUnlocked
      if (Array.isArray(newly) && newly.length) {
        uni.showToast({ title: `已解锁：${newly.map((g: any) => g.name || '权益').join('、')}`, icon: 'none', duration: 2500 })
      } else {
        uni.showToast({ title: '问卷已提交', icon: 'success' })
      }
    } else {
      uni.showToast({ title: '提交失败', icon: 'none' })
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '提交失败', icon: 'none' })
  }
}

const canWorkerScan = computed(() => {
  const m = activity.value?.checkinMode
  return m === 'worker_scan' || m === 'both'
})

const canSelf = computed(() => {
  const m = activity.value?.checkinMode
  return m === 'self' || m === 'both'
})

// 签到仅在进行中/报名开放时可用（活动结束后不显示到场签到）
const canSignin = computed(() => {
  if (!canSelf.value) return false
  const s = activity.value?.status
  return s === 'signup_open' || s === 'ongoing'
})
// 评价按钮样式：已支持自助签到用 ghost，否则 primary
const reviewBtnClass = computed(() => (canSelf.value ? 'ghost' : 'primary'))

const canCancel = computed(() => {
  const s = activity.value?.status
  return s === 'signup_open' || s === 'ongoing'
})

const usedCapacity = computed(() => activity.value?.usedCapacity ?? 0)

// ===== 宣传模块渲染 =====
const PROMO_TYPE_SET = new Set([
  'cover', 'info', 'rich', 'highlights', 'speakers', 'agenda', 'images', 'faq', 'custom',
  'rewards', 'contact', 'message',
])
const modules = computed(() =>
  (Array.isArray(activity.value?.promoModules) ? activity.value.promoModules : [])
    .filter((m: any) => m && PROMO_TYPE_SET.has(m.type))
    .sort((a: any, b: any) => Number(a.sort || 0) - Number(b.sort || 0))
)
const promoClass = computed(() => `promo-${activity.value?.promoTemplate || 'summit'}`)
// 运营端可配置 promoColors，内联 CSS 变量覆盖模板默认配色（--c-*）
const colorVars = computed(() => {
  const c = activity.value?.promoColors
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

/** 联系方式/留言模块交互：wechat=复制微信号 / phone=拨打电话 / card=名片 / message=在线留言 */
function onPromoContact(type: 'wechat' | 'phone' | 'card' | 'message') {
  const c = activity.value?.promoContact || {}
  if (type === 'phone') {
    const phone = c.phone
    if (phone) uni.makePhoneCall({ phoneNumber: String(phone) })
    else uni.showToast({ title: '暂无联系电话', icon: 'none' })
  } else if (type === 'wechat') {
    const wechat = c.wechat?.id
    if (wechat) {
      uni.setClipboardData({ data: wechat, success: () => uni.showToast({ title: '微信号已复制', icon: 'success' }) })
    } else {
      uni.showToast({ title: '暂无微信', icon: 'none' })
    }
  } else if (type === 'card') {
    const card = c.card
    const text = [card?.name, card?.title, card?.company, card?.phone, card?.wechat ? `微信：${card.wechat}` : ''].filter(Boolean).join(' · ')
    uni.showToast({ title: text || '暂无名片', icon: 'none' })
  } else {
    uni.showToast({ title: '如需咨询请使用页内联系方式', icon: 'none' })
  }
}

/** 所属活动系列（后端 populate 填充 belongsToSeries） */
const seriesInfo = computed(() => {
  const s = activity.value?.belongsToSeries
  return s?.documentId && s?.title ? s : null
})

/** 回放/资料 assets（后端 detail 返回的 { recordingUrl, materials }） */
const assets = computed(() => {
  const a = activity.value?.assets
  if (!a || typeof a !== 'object') return { recordingUrl: '', materials: [] }
  return {
    recordingUrl: a.recordingUrl || '',
    materials: Array.isArray(a.materials) ? a.materials : [],
  }
})
const hasAssets = computed(() => Boolean(assets.value.recordingUrl || assets.value.materials.length))

function openUrl(url: string) {
  if (!url) return
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在网页端打开', icon: 'none' })
  // #endif
}

function openRecording() {
  if (!assets.value.recordingUrl) return
  openUrl(assets.value.recordingUrl)
}
function openMaterial(m: { name: string; url: string }) {
  if (m?.url) openUrl(m.url)
}

function goSeries() {
  const s = seriesInfo.value
  if (!s) return
  uni.navigateTo({ url: `/pages/activity/series?id=${s.documentId}` })
}

function statusText(status: string): string {
  const map: Record<string, string> = {
    draft: '未开放',
    signup_open: '报名中',
    ongoing: '进行中',
    ended: '已结束',
  }
  return map[status] ?? status ?? ''
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function loadActivity() {
  if (!id) return
  loading.value = true
  try {
    const res = await getActivityDetail(id)
    activity.value = res ?? null
    setupActivityShare()
  } catch (e) {
    console.error('加载活动详情失败', e)
  } finally {
    loading.value = false
  }
  loadFee()
  await restoreSignupState()
  loadReviews()
  if (activity.value?.status === 'ended' || signedUp.value) loadLearning()
  if (activity.value?.status === 'ended') loadRelated()
}

// 分享图优先级：promoModules cover.bgImage → promoAssets[0] → 旧 assets[0]，与 promo-cover.vue 一致
function resolveActivityCover(a: any): string {
  const cover = (Array.isArray(a?.promoModules) ? a.promoModules : []).find((m: any) => m.type === 'cover')
  if (cover?.config?.bgImage) return resolveMediaUrl(cover.config.bgImage)
  const promoAssets = Array.isArray(a?.promoAssets) ? a.promoAssets : []
  if (promoAssets.length && promoAssets[0]?.url) return resolveMediaUrl(promoAssets[0].url)
  const legacy = Array.isArray(a?.assets) ? a.assets : []
  if (legacy.length && legacy[0]?.url) return resolveMediaUrl(legacy[0].url)
  return ''
}

function setupActivityShare() {
  const a = activity.value
  if (!a?.title) return
  const desc = (a.description || '').slice(0, 60) || undefined
  setupPageShare({ title: a.title, desc, imgUrl: resolveActivityCover(a) || undefined })
}

/** 加载活动费用预览（失败静默保留默认值） */
async function loadFee() {
  if (!id) return
  try {
    const res = await getActivityFee(id)
    if (res) {
      fee.value = {
        mode: res.mode ?? 'flat',
        cost: Number(res.cost) || 0,
        feeCollectAt: res.feeCollectAt ?? 'signup',
        name: res.name ?? '',
        base: Number(res.base) || 0,
      }
    }
  } catch (e) {
    console.warn('加载活动费用失败，使用默认值', e)
  }
}

/** 解析用户数字 ID：优先取本地，若非整数则走接口 */
async function resolveUserId(): Promise<number> {
  const user = getUser()
  const storedId = user?.id
  const n = typeof storedId === 'number' ? storedId : Number(storedId)
  if (Number.isInteger(n)) return n
  const info = await getUserInfo()
  const idNum = typeof info?.id === 'number' ? info.id : Number(info?.id)
  return Number.isInteger(idNum) ? idNum : NaN
}

/** 生成到场二维码（内容格式 activity:{activityId}:{userId}） */
async function generateQrcode() {
  const userId = await resolveUserId()
  if (!Number.isInteger(userId)) {
    uni.showToast({ title: '无法获取用户信息，二维码生成失败', icon: 'none' })
    return
  }
  const code = `activity:${id}:${userId}`
  // #ifdef H5
  // 在内存中创建 canvas 生成二维码
  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.error('无法获取canvas上下文')
    return
  }

  const qr = new UQRCode()
  qr.data = code
  qr.size = 200
  qr.make()

  const drawModules = qr.getDrawModules()

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 200, 200)

  for (let i = 0; i < drawModules.length; i++) {
    const drawModule = drawModules[i]
    if (drawModule.type === 'tile') {
      ctx.fillStyle = drawModule.color ?? '#000000'
      ctx.fillRect(drawModule.x, drawModule.y, drawModule.width, drawModule.height)
    }
  }

  qrcodeUrl.value = canvas.toDataURL('image/png')
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在H5端查看二维码', icon: 'none' })
  // #endif
}

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
  // 微信环境必走对比法引导（不再依赖 rewardConfig，无权益时以分级积分兜底）
  if (isWechatBrowser()) {
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
    const result = await signupActivity(id, formData, chosenRewardsArg, questionnaire)
    if ((result as any)?.ok) {
      if ((result as any)?.waitlisted) {
        waitlisted.value = true
        waitlistPosition.value = (result as any)?.position || 0
        uni.hideLoading()
        uni.showToast({ title: `已加入候补 #${waitlistPosition.value}`, icon: 'none' })
        return
      }
      signedUp.value = true
      waitlisted.value = false
      signupId.value = (result as any)?.signupId ?? null
      uni.hideLoading()
      uni.showToast({ title: '报名成功', icon: 'success' })
      // 引导下发奖励回显：逐个 toast
      const granted = (result as any)?.granted
      if (Array.isArray(granted) && granted.length) {
        setTimeout(() => granted.forEach((g: any, i: number) => {
          setTimeout(() => uni.showToast({ title: g.message || `已获得${g.name || ''}`, icon: 'none', duration: 2000 }), i * 2200)
        }), 800)
      }
      nextTick(() => generateQrcode())
    } else {
      uni.hideLoading()
      if ((result as any)?.reason === 'already_signed_up') {
        signedUp.value = true
        uni.showToast({ title: '您已报名过', icon: 'none' })
        nextTick(() => generateQrcode())
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

async function onCancel() {
  uni.showModal({
    title: '取消报名',
    content: '确定要取消本次报名吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await cancelActivity(id)
          if ((result as any)?.ok) {
            signedUp.value = false
            waitlisted.value = false
            waitlistPosition.value = 0
            qrcodeUrl.value = ''
            uni.showToast({ title: '已取消报名', icon: 'success' })
          } else {
            uni.showToast({ title: '取消失败', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '取消失败', icon: 'none' })
        }
      }
    },
  })
}

function getLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
      fail: (err) => reject(err),
    })
  })
}

function handleCheckinResult(result: any) {
  if (result?.ok) {
    const point = result.point
    if (point) {
      uni.showToast({ title: `已获得积分 +${point}`, icon: 'none' })
    } else {
      uni.showToast({ title: '签到成功', icon: 'success' })
    }
  } else {
    if (result?.reason === 'already_checked_in') {
      uni.showToast({ title: '您已签到过了', icon: 'none' })
    } else if (result?.reason === 'insufficient_points') {
      uni.showToast({ title: '积分不足，无法签到', icon: 'none' })
    } else {
      uni.showToast({ title: '签到失败', icon: 'none' })
    }
  }
}

async function doCheckin() {
  uni.showLoading({ title: '签到中...' })
  try {
    let result: any
    if (activity.value?.geoEnforced) {
      const loc = await getLocation()
      result = await checkinActivity(id, { method: 'self', lat: loc.latitude, lng: loc.longitude })
    } else {
      result = await checkinActivity(id, { method: 'self' })
    }
    uni.hideLoading()
    handleCheckinResult(result)
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: '签到失败', icon: 'none' })
  }
}

function onCheckin() {
  uni.showModal({
    title: '到场签到',
    content: '确认已到达现场并进行签到吗？',
    success: (res) => {
      if (res.confirm) doCheckin()
    },
  })
}

/** 恢复报名状态：若已登录，从我的报名记录判断本活动是否已报名 */
async function restoreSignupState() {
  if (!getToken()) return
  try {
    const list = (await myActivities()) as any
    const arr = Array.isArray(list) ? list : []
    const found = arr.find((r: any) => r?.activity?.documentId === id || r?.activity?.id === id)
    const st = found?.status
    waitlisted.value = st === 'waiting'
    signedUp.value = st === 'active'
    if (waitlisted.value) waitlistPosition.value = Number(found?.position) || waitlistPosition.value
    if (found?.reviewedAt) reviewed.value = true
    if (signedUp.value) nextTick(() => generateQrcode())
  } catch (e) {
    // 无需登录则跳过，登录跳转交给 request 内部逻辑
  }
}

/** 打开评价弹层（已提交则提示） */
function openReview() {
  if (reviewed.value) {
    uni.showToast({ title: '已评价过', icon: 'none' })
    return
  }
  showReview.value = true
}

/** 提交评价 */
async function submitReview() {
  if (!reviewRating.value || reviewRating.value < 1) {
    uni.showToast({ title: '请先选择评分（1-5星）', icon: 'none' })
    return
  }
  try {
    const result = await submitActivityReview(id, {
      rating: reviewRating.value,
      nps: reviewNps.value ?? undefined,
      review: reviewText.value || undefined,
    })
    if ((result as any)?.ok) {
      reviewed.value = true
      showReview.value = false
      uni.showToast({ title: '评价成功', icon: 'success' })
    } else {
      uni.showToast({ title: '评价失败', icon: 'none' })
    }
  } catch (e: any) {
    const msg = e?.error?.message || e?.message || ''
    if (msg.includes('尚未报名')) {
      uni.showToast({ title: '尚未报名，无法评价', icon: 'none' })
    } else {
      uni.showToast({ title: '评价失败', icon: 'none' })
    }
  }
}

async function loadReviews() {
  if (!id) return
  try {
    const payload = await getActivityReviews(id)
    if (Array.isArray(payload?.rows)) {
      reviews.value = payload.rows
      reviewSummary.value = payload.summary ?? { count: 0, avgRating: 0, reviewCount: 0 }
    } else if (Array.isArray(payload)) {
      reviews.value = payload
    }
  } catch (e) {
    console.warn('加载评价失败', e)
  }
}

function starText(rating: number): string {
  const n = Math.max(0, Math.min(5, Number(rating) || 0))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function shortDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}-${d.getDate()}`
}

async function loadLearning() {
  if (!id || !getToken()) return
  try {
    const payload = await getMyActivityLearning(id)
    learningContent.value = payload ?? null
  } catch (e) {
    console.warn('加载学习内容失败', e)
  }
}

function goCourse(c: any) {
  if (c?.documentId) uni.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${c.documentId}` })
}

function openLearnLesson(l: any) {
  if (l?.course?.documentId) goCourse(l.course)
  else if (l?.documentId) uni.showToast({ title: '请在课程详情中学习', icon: 'none' })
}

function openLearnArticle(a: any) {
  if (a?.url) openUrl(a.url)
  else uni.showToast({ title: '文章：' + (a?.title || ''), icon: 'none' })
}

async function loadRelated() {
  if (!id) return
  try {
    let list: any[] = []
    const seriesId = activity.value?.belongsToSeries?.documentId
    if (seriesId) {
      const s = await getSeries(seriesId)
      list = Array.isArray(s?.activities) ? s.activities : []
    } else if (activity.value?.category) {
      const res = await listActivities({ category: activity.value.category, page: 1, pageSize: 8 } as any)
      const arr = (res as any)?.data ?? res
      list = Array.isArray(arr) ? arr : []
    }
    relatedActivities.value = list
      .filter((a: any) => a.documentId !== id && a.status === 'signup_open')
      .slice(0, 3)
  } catch (e) {
    console.warn('加载相关活动失败', e)
  }
}

function goDetail(ra: any) {
  uni.navigateTo({ url: `/pages/activity/detail?id=${ra.documentId}` })
}

onMounted(() => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as any
  id = page?.options?.id || page?.$page?.options?.id || ''
  loadActivity()
})

onShow(() => {
  if (id && activity.value) {
    restoreSignupState()
    setupActivityShare()
  }
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx 30rpx 160rpx;
}

/* 宣传模块区块：背景/文字色取配色方案 --c-bg/--c-text（模板默认或 promoColors 内联覆盖），
   与独立宣传页 promo.vue 保持一致，避免 --c-bg 定义了却不生效 */
.promo-section {
  background: var(--c-bg);
  color: var(--c-text);
  border-radius: 16rpx;
  margin-top: 20rpx;
  padding: 30rpx 0 40rpx;
}

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.head-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.series-chip {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #f6f4ff;
  border-radius: 20rpx;
  padding: 6rpx 18rpx;
  margin-bottom: 12rpx;
}

.series-chip-text {
  font-size: 22rpx;
  color: #667eea;
  max-width: 420rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-chip-arrow {
  font-size: 24rpx;
  color: #764ba2;
}

.title {
  flex: 1;
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.status-tag {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  white-space: nowrap;

  &.status-signup_open {
    background: #e6f7ff;
    color: #1890ff;
  }
  &.status-ongoing {
    background: #f6ffed;
    color: #52c41a;
  }
  &.status-ended {
    background: #f5f5f5;
    color: #999;
  }
  &.status-draft {
    background: #f0f0f0;
    color: #bbb;
  }
}

.info-row {
  display: flex;
  align-items: flex-start;
  padding: 10rpx 0;
}

.info-label {
  width: 90rpx;
  font-size: 26rpx;
  color: #999;
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  font-size: 26rpx;
  color: #333;
  line-height: 1.5;
}

.desc {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.desc-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 12rpx;
}

.desc-content {
  display: block;
  font-size: 26rpx;
  color: #666;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}

.qr-card {
  text-align: center;
}

.qr-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
}

.qr-tip {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin: 8rpx 0 20rpx;
}

.qr-box {
  width: 320rpx;
  height: 320rpx;
  margin: 0 auto;
  background: #fafafa;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.qr-img {
  width: 100%;
  height: 100%;
}

.qr-placeholder {
  font-size: 24rpx;
  color: #999;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  display: flex;
  gap: 20rpx;
  z-index: 10;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;

  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
  &.ghost {
    background: #fff;
    color: #667eea;
    border: 2rpx solid #667eea;
  }
  &.waiting { background: #faad14; color: #fff; }
  &.normal { background: #fff; color: #666; border: 1rpx solid #ddd; }
}

.loading-state {
  padding: 120rpx 30rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999;
}

.share-entry {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 16rpx;
  padding: 26rpx 30rpx;
  margin-bottom: 20rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 500;
}

.review-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.review-panel {
  width: 640rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx 40rpx 30rpx;
  box-sizing: border-box;
}
.review-title {
  display: block;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 30rpx;
}
.review-field-label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 16rpx;
}
.star-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 30rpx;
}
.star {
  font-size: 52rpx;
  color: #ddd;
}
.star.active {
  color: #fa8c16;
}
.star-value {
  font-size: 24rpx;
  color: #999;
  margin-left: 8rpx;
}
.nps-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 30rpx;
}
.nps-num {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  border-radius: 8rpx;
  background: #f5f5f5;
  color: #666;
  font-size: 24rpx;
}
.nps-num.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}
.review-textarea {
  width: 100%;
  height: 160rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 20rpx;
  box-sizing: border-box;
  font-size: 26rpx;
  margin-bottom: 30rpx;
}
.textarea-placeholder {
  color: #bbb;
}
.review-actions {
  display: flex;
  gap: 20rpx;
}
.review-btn {
  flex: 1;
  text-align: center;
  padding: 22rpx 0;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
}
.review-btn.cancel {
  background: #f5f5f5;
  color: #666;
}
.review-btn.submit {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

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

/* 对比法：授权主卡高亮，静默弱化 */
.guide-opt.primary.highlight {
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102,126,234,.14) 0%, rgba(118,75,162,.14) 100%);
}
.guide-opt.muted {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  padding: 20rpx 8rpx;
  align-items: flex-start;
}
.guide-opt.muted .guide-opt-title.muted-title { font-size: 26rpx; color: #999; font-weight: 400; text-decoration: underline; }
.guide-benefits { display: flex; flex-direction: column; gap: 6rpx; margin-top: 8rpx; }
.guide-benefit { font-size: 22rpx; color: #5b4bb5; }
.guide-btn.auth {
  margin-top: 20rpx; padding: 16rpx 0; border-radius: 36rpx; text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; font-size: 28rpx; font-weight: 600;
}
/* 关注二维码 */
.qrcode-container { display: flex; justify-content: center; padding: 16rpx 0 8rpx; }
.qrcode-img { width: 360rpx; height: 360rpx; }
.qrcode-placeholder, .qrcode-hint { display: block; text-align: center; font-size: 24rpx; color: #999; }
.qrcode-hint { margin-bottom: 8rpx; }
/* 积分明细 */
.points-preview { border: 1rpx solid #eee; border-radius: 12rpx; padding: 8rpx 20rpx; margin-bottom: 16rpx; }
.points-item { display: flex; justify-content: space-between; align-items: center; padding: 12rpx 0; }
.points-item-name { font-size: 26rpx; color: #333; }
.points-item-val { font-size: 26rpx; font-weight: 600; color: #fa8c16; }
/* 问卷入口 */
.survey-entry { display: flex; justify-content: space-between; align-items: center; padding: 20rpx; border: 1rpx dashed #667eea; border-radius: 12rpx; margin-bottom: 20rpx; }
.survey-entry-text { font-size: 26rpx; color: #667eea; }
.survey-entry-arrow { font-size: 28rpx; color: #667eea; }

.assets-card { padding: 30rpx; }
.assets-title { display: block; font-size: 28rpx; font-weight: 600; color: #333; margin-bottom: 20rpx; }
.assets-item {
  display: flex; align-items: center; gap: 16rpx; padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
  &:last-child { border-bottom: none; }
}
.assets-icon { font-size: 30rpx; color: #667eea; }
.assets-name { flex: 1; font-size: 28rpx; color: #333; }
.assets-arrow { font-size: 28rpx; color: #ccc; }

.reviews-card { margin-top: 20rpx; }
.reviews-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16rpx; }
.reviews-title { font-size: 32rpx; font-weight: 600; color: #333; }
.reviews-score { display: flex; align-items: baseline; }
.reviews-score-num { font-size: 44rpx; font-weight: bold; color: #fa8c16; }
.reviews-score-sub { font-size: 22rpx; color: #999; margin-left: 8rpx; }
.review-item { padding: 20rpx 0; border-top: 1rpx solid #f5f5f5; }
.review-item-top { display: flex; align-items: center; gap: 16rpx; }
.review-stars { color: #fa8c16; font-size: 24rpx; }
.review-user { font-size: 24rpx; color: #666; flex: 1; }
.review-time { font-size: 22rpx; color: #bbb; }
.review-text { display: block; font-size: 26rpx; color: #333; margin-top: 10rpx; line-height: 1.6; }

.archived-tag { flex-shrink: 0; font-size: 22rpx; color: #999; background: #f5f5f5; padding: 4rpx 12rpx; border-radius: 8rpx; }
.learn-card { margin-top: 20rpx; }
.learn-title { font-size: 32rpx; font-weight: 600; color: #333; display: block; margin-bottom: 8rpx; }
.learn-item { display: flex; align-items: center; padding: 18rpx 0; border-top: 1rpx solid #f5f5f5; }
.learn-icon { font-size: 28rpx; margin-right: 14rpx; }
.learn-name { flex: 1; font-size: 26rpx; color: #333; }
.learn-arrow { color: #ccc; font-size: 28rpx; }

.related-card { margin-top: 20rpx; }
.related-title { font-size: 32rpx; font-weight: 600; color: #333; display: block; margin-bottom: 8rpx; }
.related-item { display: flex; align-items: center; padding: 20rpx 0; border-top: 1rpx solid #f5f5f5; }
.related-main { flex: 1; }
.related-name { display: block; font-size: 28rpx; color: #333; }
.related-time { display: block; font-size: 24rpx; color: #999; margin-top: 6rpx; }
.related-cta { flex-shrink: 0; font-size: 24rpx; color: #667eea; border: 1rpx solid #667eea; padding: 6rpx 20rpx; border-radius: 24rpx; }
</style>