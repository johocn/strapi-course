<template>
  <view class="page-container">
    <view v-if="activity" class="detail-wrap">
      <!-- 完全定制模式下隐藏顶部固定信息卡；仅当「完全定制生效（有HTML且 active=true）」时走定制，否则保留原信息卡+AI模块 -->
      <view v-if="activity && !(customPromoHtml && customPromoActive)" class="card hero-card" :class="promoClass" :style="colorVars">
        <view class="hero-accent" />
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

      <!-- 宣传文案：完全定制优先，否则回退运营端 promoModules 模块组合 -->
      <!-- 完全定制不套用运营端主题 promoClass/--c-* 变量，呈现层完全由客户 HTML 决定，不受限 -->
      <view v-if="customPromoHtml && customPromoActive" class="promo-custom-wrap">
        <PromoCustomPage :activity="activity" />
      </view>
      <view v-else-if="modules.length" class="promo-page promo-section" :class="promoClass" :style="colorVars">
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

      <!-- 分享裂变入口 -->
      <view class="share-row">
        <view class="share-entry" @click="showSharePoster = true">
          <text class="share-entry-title">分享海报</text>
          <text class="share-entry-sub">生成专属邀请海报</text>
        </view>
        <view class="invite-entry" @click="goMyInvitation">
          <text class="invite-entry-title">我的邀请</text>
          <text class="invite-entry-sub">看邀请战绩</text>
        </view>
      </view>
      <view v-if="shareTip" class="share-tip">
        <text>{{ shareTip }}</text>
      </view>
      <!-- 分享领分按钮：点亮才可领，置灰显示原因 -->
      <view class="share-claim-row">
        <view class="share-claim-btn" :class="{ disabled: !shareCanClaim }" @click="claimSharePoints">
          <text>{{ shareCanClaim ? `领${sharePoints}积分` : '未到领取时间' }}</text>
        </view>
      </view>
      <view v-if="!shareCanClaim && shareReason" class="share-claim-reason"><text>{{ shareReason }}</text></view>

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
        <view v-if="showFillQuestionnaireBtn" class="action-btn ghost" @click="openPostFillQuestionnaire">
          <text>补填问卷</text>
        </view>
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

      <!-- 报名后「领取更多权益」卡片区 -->
      <view v-if="signedUp && signupId" id="benefit-section" class="benefit-section">
        <view class="benefit-head">
          <text class="benefit-title">领取更多权益</text>
          <text class="benefit-add" v-if="benefitPointsLeft > 0">+{{ benefitPointsLeft }} 待解锁</text>
        </view>
        <view v-for="c in benefitCards" :key="c.key" class="benefit-card" :class="{ done: c.done, reward: c.reward, locked: c.locked }" @click="onBenefitCard(c)">
          <view class="benefit-ic">{{ c.reward ? '礼' : (c.key === 'contact' ? '电' : c.key === 'survey' ? '问' : c.key === 'postSurvey' ? '后' : '关') }}</view>
          <view class="benefit-mid">
            <text class="benefit-name">{{ c.name }}</text>
            <text class="benefit-desc">{{ c.desc }}</text>
          </view>
          <text class="benefit-state done-tag" v-if="c.done">✓ 已领</text>
          <text class="benefit-state wait-tag" v-else-if="c.locked">待解锁</text>
          <text class="benefit-state go" v-else-if="c.points">+{{ c.points }}</text>
          <text class="benefit-state go" v-else>去解锁</text>
        </view>

        <!-- 联系方式补填弹窗 -->
        <view class="signup-mask" v-if="showContactFill" @click="showContactFill = false">
          <view class="signup-panel benefit-contact-panel" @click.stop>
            <text class="signup-title">完善联系方式</text>
            <text class="benefit-inline-tip">补充联系方式可解锁 +20 积分及联系方式相关权益。</text>
            <view v-for="f in formFields" :key="f.key" class="signup-field">
              <text class="signup-label">{{ f.label }}<text v-if="f.required" class="req">*</text></text>
              <input v-if="f.type === 'text' || f.type === 'phone'" class="signup-input"
                v-model="contactForm[f.key]" :type="f.type === 'phone' ? 'number' : 'text'"
                :placeholder="f.placeholder || ''" />
              <textarea v-else-if="f.type === 'textarea'" class="signup-textarea" v-model="contactForm[f.key]" />
              <input v-else-if="f.type === 'number'" class="signup-input" type="number" v-model="contactForm[f.key]" />
            </view>
            <view class="guide-actions">
              <view class="signup-btn cancel" @click="showContactFill = false"><text>取消</text></view>
              <view class="signup-btn submit" @click="submitBenefitContact"><text>提交</text></view>
            </view>
          </view>
        </view>

        <!-- 关注公众号内联领取 -->
        <view v-if="showSubscribeFill" class="benefit-inline">
          <text class="benefit-follow-tip">用微信扫码关注公众号，关注后自动领取 +50 积分及订阅类权益。</text>
          <view class="benefit-follow-qr">
            <image v-if="wxQrcodeUrl" class="benefit-follow-img" mode="aspectFit" :src="wxQrcodeUrl"
              @longpress="saveFollowQrcode" />
            <text v-else class="benefit-follow-empty">暂无可扫二维码，请稍后重试</text>
          </view>
          <view class="signup-actions">
            <view class="signup-btn cancel" @click="showSubscribeFill = false"><text>稍后</text></view>
            <view class="signup-btn submit" @click="submitBenefitSubscribe"><text>我已关注，刷新领取</text></view>
          </view>
        </view>

        <!-- +50 飘分动画 -->
        <view v-if="floatShow" class="benefit-float" :class="{ show: floatShow }">
          <text class="benefit-float-text">{{ floatMsg }}</text>
        </view>
      </view>

      <!-- 报名成功且存在未解锁权益时的悬浮「领取权益」入口 -->
      <view v-if="signedUp && signupId && claimBarVisible" class="claim-float" @click="scrollToBenefit">
        <text class="claim-float-text">去领权益</text>
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

    <!-- 问卷弹层（活动前/活动后共用；活动前问卷按 step 分步收集） -->
    <view class="signup-mask" v-if="showQuestionnaire" @click="showQuestionnaire = false">
      <view class="signup-panel" @click.stop>
        <text class="signup-title">{{ questionnaireKind === 'post' ? '活动后问卷' : '活动前问卷' }}<span v-if="isFillQuestionnaire && questionnaireKind === 'pre'">（+50 积分）</span></text>
        <text v-if="currentStepGroup && currentStepGroup.label" class="signup-step-label">{{ currentStepGroup.label }}</text>
        <view v-for="f in (currentStepGroup ? currentStepGroup.fields : [])" :key="f.key" class="signup-field">
          <text class="signup-label">{{ f.label }}<text v-if="f.required" class="req">*</text></text>

          <input v-if="f.type === 'text' || f.type === 'phone'" class="signup-input"
            v-model="currentQData[f.key]" :type="f.type === 'phone' ? 'number' : 'text'"
            :placeholder="f.placeholder || ''" />

          <textarea v-else-if="f.type === 'textarea'" class="signup-textarea" v-model="currentQData[f.key]" />

          <view v-else-if="f.type === 'radio'" class="signup-options">
            <text v-for="o in (f.options || [])" :key="o" class="signup-opt"
              :class="{ on: currentQData[f.key] === o }" @click="currentQData[f.key] = o">{{ o }}</text>
          </view>

          <picker v-else-if="f.type === 'select'" mode="selector" :range="(f.options || [])"
            @change="e => currentQData[f.key] = (f.options || [])[Number(e.detail.value)]">
            <view class="signup-picker">
              <text>{{ currentQData[f.key] || '请选择' }}</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>

          <view v-else-if="f.type === 'multi'" class="signup-options">
            <text v-for="o in (f.options || [])" :key="o" class="signup-opt"
              :class="{ on: (currentQData[f.key] || []).includes(o) }"
              @click="toggleQuestionnaireMulti(f, o)">{{ o }}</text>
          </view>
          <view v-if="f.type === 'multi' && (currentQData[f.key] || []).includes('其他')" class="signup-other">
            <input class="signup-input" v-model="qOtherText[f.key]" placeholder="补充说明（选填）" @input="setQOther(f)" />
          </view>

          <input v-else-if="f.type === 'number'" class="signup-input" type="number" v-model="currentQData[f.key]" />
        </view>
        <view v-if="questionnaireStepGroups.length > 1" class="signup-step-nav">
          <text v-for="(g, gi) in questionnaireStepGroups" :key="gi" class="signup-step-dot"
            :class="{ on: gi === questionnaireStep }">{{ gi + 1 }}</text>
        </view>
        <view class="signup-actions">
          <view class="signup-btn cancel" @click="showQuestionnaire = false"><text>取消</text></view>
          <view v-if="questionnaireStepGroups.length > 1 && questionnaireStep > 0" class="signup-btn cancel" @click="questionnaireStep--"><text>上一步</text></view>
          <view v-if="questionnaireStepGroups.length > 1 && questionnaireStep < questionnaireStepGroups.length - 1" class="signup-btn submit" @click="questionnaireStep++"><text>下一步</text></view>
          <view v-else class="signup-btn submit" @click="isFillQuestionnaire ? submitFillQuestionnaire() : submitQuestionnaire"><text>提交</text></view>
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

        <!-- 浏览器环境第 3 步：信息完善（联系方式+20 / 问卷+50，选填；微信环境跳过） -->
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

        <!-- Step2 报名奖励（必得区 + 解锁区，覆盖原独立清单弹窗） -->
        <template v-else-if="guideStep === 'reward'">
          <text class="guide-tip">以下奖励可领取{{ multiRewards.length ? '，可多选' : '' }}</text>

          <scroll-view scroll-y class="guide-reward-body">
            <!-- 解锁通道：解锁区权益的共同达成前提 -->
            <view class="reward-preview-channel" v-if="previewUnlockRewards.length && channelPreviewLabel">
              <text class="reward-preview-channel-title">解锁通道</text>
              <text class="reward-preview-channel-value">{{ channelPreviewLabel }}</text>
              <text class="reward-preview-checked" v-if="rewardPreviewData?.channelDone">已达成</text>
            </view>

            <!-- 必得区：无条件权益/积分 -->
            <template v-if="previewMustGetRewards.length">
              <text class="reward-preview-sec-title">必得区<text class="reward-preview-hint">确认报名即得</text></text>
              <view class="rpc-grid">
                <view v-for="r in previewMustGetRewards" :key="r.id" class="rpc-card must">
                  <text class="rpc-ico" :class="'ic-' + rewardIcoClass(r)">{{ rewardIcon(r) }}</text>
                  <text class="rpc-name">{{ r.name }}</text>
                  <text class="rpc-meta" v-if="r.type !== 'points'">{{ rewardMeta(r) }}</text>
                  <view class="rpc-row">
                    <text class="rpc-state ok">必得</text>
                    <text class="rpc-val" v-if="r.points">+{{ r.points }}</text>
                  </view>
                </view>
              </view>
            </template>

            <!-- 解锁区：带条件权益（锁头 + 条件标注 + selectMode 提示 + multi 勾选） -->
            <template v-if="previewUnlockRewards.length">
              <text class="reward-preview-sec-title unlock">解锁区<text class="reward-preview-hint">{{ previewSelectHint }}</text></text>
              <view class="rpc-grid">
                <view v-for="r in previewUnlockRewards" :key="r.id" class="rpc-card"
                  :class="{ locked: !r.unlocked, done: r.unlocked }" @click="toggleGuideReward(r)">
                  <text class="rpc-lock" :class="r.unlocked ? 'ok' : 'todo'">{{ r.unlocked ? '✓' : '' }}</text>
                  <text class="rpc-ico" :class="'ic-' + rewardIcoClass(r)">{{ rewardIcon(r) }}</text>
                  <text class="rpc-name">{{ r.name }}</text>
                  <text class="rpc-meta" v-if="rewardMeta(r).length">{{ rewardMeta(r) }}</text>
                  <text class="rpc-cond" v-if="rewardCondText(r)">{{ rewardCondText(r) }}</text>
                  <view class="rpc-row">
                    <text class="rpc-state" :class="r.unlocked ? 'ok' : 'todo'">{{ r.unlocked ? (r.mode === 'multi' ? '勾选领取' : '自动领取') : '去解锁' }}</text>
                    <text class="rpc-val" v-if="r.points">+{{ r.points }}</text>
                  </view>
                </view>
              </view>
            </template>
          </scroll-view>

          <view class="guide-actions">
            <view class="signup-btn cancel" @click="showGuide = false"><text>取消</text></view>
            <view class="signup-btn submit" @click="goNextGuide"><text>确认并报名</text></view>
          </view>
        </template>

        </view>
    </view>

    <!-- 分享海报（复用通用 share-poster 组件） -->
    <share-poster
      :visible="showSharePoster"
      @close="onSharePosterClosed"
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
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { onShow, onPageScroll } from '@dcloudio/uni-app'
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
  fillActivityContact,
  claimActivitySubscribe,
  getSignupUnlockStatus,
} from '../../services/api'
import { getToken, getUser } from '../../utils/storage'
import { isWechatBrowser, resolveMediaUrl } from '../../utils/env'
import { setupPageShare } from '../../utils/share'
import { redirectToWechatAuth } from '../../utils/wx-h5-login'
import { shouldUseSso, buildSsoPageUrl } from '../../utils/login-chain'
import { getStoredAuthConfig } from '../../services/auth-config'
import { useShareClaim, shareReasonText } from '../../utils/use-share-claim'
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
import PromoCustomPage from '../../components/promo/promo-custom-page.vue'

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
// 分享领分状态：距离上次成功 >= 冷却分钟后点亮，成功即置灰进入下一轮冷却；跨日不自动解锁
const { state: shareClaim, refresh: refreshShare, claim: claimShare } = useShareClaim(() => id)
const shareCanClaim = computed(() => shareClaim.value.canClaim)
const sharePoints = computed(() => shareClaim.value.points)
const shareReason = computed(() => shareReasonText(shareClaim.value))

async function claimSharePoints() {
  if (!shareCanClaim.value) {
    if (shareReason.value) uni.showToast({ title: shareReason.value, icon: 'none' })
    return
  }
  const r = await claimShare()
  if (r.ok) uni.showToast({ title: `分享成功 +${r.points}积分`, icon: 'none' })
  else if (r.message) uni.showToast({ title: r.message, icon: 'none' })
}

// 分享海报关闭时尝试领一次分享积分（点亮才领，置灰时给原因提示，不阻断查看海报）
async function onSharePosterClosed() {
  showSharePoster.value = false
  await claimSharePoints()
}
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
const guideStep = ref<'login' | 'info' | 'reward' | ''>('')
const loginAuth = ref(false)
const chosenRewards = ref<string[]>([])
const grantMessages = ref<{ message: string; link?: string }[]>([])
// v2 递进式领取：问卷数据 / 关注状态 / 后端解锁探测 / 报名记录
const questionnaireData = ref<Record<string, any>>({})
const postQuestionnaireData = ref<Record<string, any>>({})
const subscribed = ref(false)
const unlockStatus = ref<any>(null)
const signupId = ref<number | null>(null)
const showFillQuestionnaire = ref(false)
const showQuestionnaire = ref(false)
// 问卷弹层上下文：false=报名引导 info 步记录（记完继续引导）；true=报名后补填（提交解锁 survey 权益）
const isFillQuestionnaire = ref(false)
// 问卷类型：pre=活动前问卷（报名后可填，驱动解锁/积分）；post=活动后问卷（签到且活动结束后，仅记录反馈）
const questionnaireKind = ref<'pre' | 'post'>('pre')
// 分步收集当前步骤（活动前问卷按 step 1-5 分步展示）
const questionnaireStep = ref(0)

// ---- 报名奖励清单数据（引导 reward 步骤展示，来自 unlockCheck） ----
const rewardPreviewData = ref<any>(null)   // unlockCheck 返回结果

/** 是否无条件（condition 为 none/空）→ 归入必得区；其余带条件进解锁区 */
function rewardIsUnconditional(r: any): boolean {
  return !r?.condition || r.condition === 'none'
}

/** 条件类型 → 条件标注文案 */
const REWARD_COND_LABEL: Record<string, string> = {
  wechat_auth: '微信授权登录',
  subscribe: '关注公众号',
  contact: '留联系方式',
  survey: '报名后可填',
  post_survey: '签到且活动结束后',
}
function rewardCondText(r: any): string {
  return REWARD_COND_LABEL[r?.condition] || ''
}

/** 必得区：无条件权益/积分 */
const previewMustGetRewards = computed(() => {
  const rewards = Array.isArray(rewardPreviewData.value?.rewards) ? rewardPreviewData.value.rewards : []
  return rewards.filter(rewardIsUnconditional)
})

/** 解锁区：带条件权益 */
const previewUnlockRewards = computed(() => {
  const rewards = Array.isArray(rewardPreviewData.value?.rewards) ? rewardPreviewData.value.rewards : []
  return rewards.filter((r: any) => !rewardIsUnconditional(r))
})

/** 解锁通道名称（弹层顶部提示条） */
const channelPreviewLabel = computed(() => rewardPreviewData.value?.channel?.label || '')

/** 解锁区 selectMode 提示：与卡片区 selectModeHint(L1012) 口径一致 */
const previewSelectHint = computed(() => {
  const mode = rewardPreviewData.value?.selectMode || 'all'
  const n = Math.max(1, Number(rewardPreviewData.value?.selectN) || 1)
  if (mode === 'one') return '（单选）'
  if (mode === 'any') return `（任选最多 ${n} 项）`
  return '（可多选）'
})

const hasRewardPreview = computed(() => previewMustGetRewards.value.length > 0 || previewUnlockRewards.value.length > 0)

const typeLabelMap: Record<string, string> = {
  points: '积分', coupon: '优惠券', course_trial: '试听课程', course_outline: '课时/大纲', article: '文章',
}
/** 权益图标：统一用文字徽标（emoji 在 Windows 桌面不显示字体，改用色彩块+类型字，跨端可靠） */
function rewardIcon(r: any): string {
  switch ((r?.type || '').toLowerCase()) {
    case 'points': return '分'
    case 'coupon': return '券'
    case 'course_trial': return '课'
    case 'course_outline': return '课'
    case 'article': return '文'
    default: return '资'
  }
}
/** 图标徽标配色类 */
function rewardIcoClass(r: any): string {
  switch ((r?.type || '').toLowerCase()) {
    case 'points': return 'pts'
    case 'coupon': return 'coup'
    case 'course_trial': return 'ctr'
    case 'course_outline': return 'ctr'
    case 'article': return 'art'
    default: return 'def'
  }
}
function typeTag(r: any): string { return typeLabelMap[(r?.type || '').toLowerCase()] || '权益' }
function rewardMeta(r: any): string { return (r?.meta && r.meta !== r?.name) ? r.meta : typeTag(r) }

// ---- 报名后「领取更多权益」卡片区 ----
const unlockCtx = ref<any>(null)            // getSignupUnlockStatus 结果
const showContactFill = ref(false)          // 联系方式内联表单展开
const contactForm = ref<Record<string, any>>({})
const showSubscribeFill = ref(false)        // 关注内联领取展开

/** 报名后拉取解锁状态并回填卡片区 */
const notifiedRewards = ref(new Set<string>()) // 已提示过解锁的权益 id，避免重复弹
async function loadSignupUnlock() {
  if (!signupId.value) return
  try {
    const res = await getSignupUnlockStatus(signupId.value)
    unlockCtx.value = res || null
    // 权益解锁特效提示（每次拉取后对新解锁的权益弹提示）
    const rewards = Array.isArray((res as any)?.rewards) ? (res as any).rewards : []
    for (const r of rewards) {
      if (r && r.unlocked && !notifiedRewards.value.has(String(r.id || r.name))) {
        notifiedRewards.value.add(String(r.id || r.name))
        triggerFloat(0, `权益已解锁：${r.name || '权益'}`)
      }
    }
  } catch (e) {
    console.warn('加载权益状态失败', e)
  }
}
// 公众号关注二维码（报名后「领取更多权益」关注项使用；未配置公众号时 followEnabled=false 跳过）
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

// 信息步：有报名表单(电话)或问卷且对应项未填才需要。
// 姓名/手机号/问卷目的是搜集信息，仅浏览器（非微信）环境必填；
// 微信授权用户已通过微信识别身份，直接报名、不强制留联系方式与问卷，信息项移入权益选填解锁。
const isWxEnv = isWechatBrowser()
const hasPhoneField = computed(() => formFields.value.some((f: any) => f?.type === 'phone' && f?.key))
const needsInfo = computed(() => {
  // 微信环境直接报名、取消信息环节，姓名/电话/问卷均不阻塞报名
  if (isWxEnv) return false
  const contactNeeded = hasPhoneField.value && !channelFilledValue('contact')
  const surveyNeeded = questionnaireFields.value.length > 0 && !surveyFilledValue()
  return contactNeeded || surveyNeeded
})

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
  guideStep.value = resolveGuideStep()
  // 无任何需要引导的步骤（已登录且无奖励/无需补信息）→ 直接报名，避免空面板
  if (!guideStep.value) {
    showGuide.value = false
    confirmGuideSignup()
  }
}

/** 调用后端解锁探测，刷新 loginAuth/subscribed/unlockStatus 及报名奖励清单数据 */
async function refreshUnlockStatus() {
  try {
    const st = await unlockCheck(id, { ...signupData.value }, questionnaireData.value)
    unlockStatus.value = st || null
    rewardPreviewData.value = st || null
    loginAuth.value = !!st?.loginAuth
    subscribed.value = !!st?.subscribed
  } catch (e) {
    unlockStatus.value = null
    rewardPreviewData.value = null
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

// ===== 领积分 +N 飘分动画（points > 0 显示 +N 文案，否则仅展示 msg，如权益解锁） =====
const floatText = ref(0)
const floatMsg = ref('积分已到账')
const floatShow = ref(false)
let floatTimer: any = null
function triggerFloat(points = 50, msg = '积分已到账') {
  floatText.value = points
  floatMsg.value = points > 0 ? `+${points} ${msg}` : msg
  floatShow.value = false
  nextTick(() => { floatShow.value = true })
  if (floatTimer) clearTimeout(floatTimer)
  floatTimer = setTimeout(() => { floatShow.value = false }, 3400)
}

// ===== 扫码关注自动判定轮询（面板打开且未关注时每 4s 探测一次，命中即自动领取） =====
let subscribeTimer: any = null
async function subscribeStartPolling() {
  subscribeStopPolling()
  if (!signupId.value || subscribed.value) return
  subscribeTimer = setInterval(async () => {
    try {
      const st = await getSignupUnlockStatus(signupId.value)
      if (st?.subscribed) {
        subscribeStopPolling()
        await submitBenefitSubscribe()
      }
    } catch (e) { /* 单次探测失败忽略，继续轮询 */ }
  }, 4000)
}
function subscribeStopPolling() {
  if (subscribeTimer) { clearInterval(subscribeTimer); subscribeTimer = null }
}

/** 长按保存二维码（H5 用 uni.downloadFile 后存入相册；小程序由原生支持） */
function saveFollowQrcode() {
  if (!wxQrcodeUrl.value) return
  // #ifdef H5
  uni.downloadFile({
    url: wxQrcodeUrl.value,
    success: (r: any) => {
      if (r.statusCode === 200) uni.saveImageToPhotosAlbum({ filePath: r.tempFilePath })
      else uni.showToast({ title: '保存失败', icon: 'none' })
    },
    fail: () => uni.showToast({ title: '保存失败', icon: 'none' }),
  })
  // #endif
}

/** 引导步骤链：login → reward(报名奖励清单，第二步) → [info 仅浏览器] → 报名。
 *  微信环境：login → reward → 报名（取消 info/follow）；
 *  浏览器环境：login → reward → info → 报名（取消 follow）。权益可报名后补领。 */
function resolveNextStep(): string {
  const s = guideStep.value
  if (s === '' || s === 'login') {
    if (hasRewardPreview.value) return 'reward'
    if (needsInfo.value) return 'info'
    return ''
  }
  if (s === 'reward') return needsInfo.value ? 'info' : ''
  return '' // info → 报名
}
function resolveGuideStep(): string {
  // login 对比步仅微信环境展示；浏览器环境未登录也直接进 reward/info，不强制登录
  if (isWechatBrowser() && !loginAuth.value) return 'login'
  return resolveNextStep()
}

/** 推进引导下一步；已无剩余步骤（info/follow/reward 均无）则直接报名（不做二次确认） */
function goNextGuide() {
  const step = resolveNextStep()
  if (step) guideStep.value = step
  else confirmGuideSignup()
}
function goGuideOrSignup() {
  const step = resolveGuideStep()
  if (step) guideStep.value = step
  else confirmGuideSignup()
}

/** 静默/跳过登录：跳过登录对比步，继续后续 info/follow/reward */
function chooseSilentLogin() {
  loginAuth.value = false
  goNextGuide()
}

async function chooseAuthLogin() {
  // 按站点认证模式分发授权：SSO 站点走 SSO（v.joho.cn 的微信授权经 h.joho.cn 中转，
  // SSO 登录即完成微信授权并落库 sso 绑定 → loginAuth 为真）；third 站点才走 zhao-third OAuth。
  // 各走各的：避免 SSO 站点被塞 zhao-third 流程导致授权失败、授权弹窗反复出现。
  uni.setStorageSync(REWARD_GUIDE_KEY, { activityId: id, loginAuth: true })
  const authConfig = getStoredAuthConfig()
  if (shouldUseSso(authConfig)) {
    // 已登录（SSO 会话在）：无需再往返 SSO，直接重探测解锁状态，避免 auth-callback 跳首页把用户弹走
    if (getToken()) {
      await refreshUnlockStatus()
      goGuideOrSignup()
      return
    }
    const ssoUrl = buildSsoPageUrl(authConfig, 'login')
    if (ssoUrl) {
      // 未登录走 SSO 统一登录（SSO 即微信授权，经 h.joho.cn 中转）；完成后回 auth-callback，
      // 引导进度由 REWARD_GUIDE_KEY 续接
      window.location.href = ssoUrl
      return
    }
  }
  // third 模式 / SSO 未配置兜底：zhao-third 公众号授权
  redirectToWechatAuth('snsapi_userinfo').catch(() => {
    uni.removeStorageSync(REWARD_GUIDE_KEY)
  })
}

/** 信息步进完成：重新评估下一步（可能仍需 info） */
function continueInfo() {
  goNextGuide()
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
/** 活动前问卷题目：优先 preQuestionnaire，兼容仅配置 questionnaire 的旧活动（回退为活动前问卷） */
const questionnaireFields = computed(() => {
  const pre = activity.value?.preQuestionnaire
  if (pre && pre.enabled === true && Array.isArray(pre.fields) && pre.fields.length) return pre.fields
  const legacy = activity.value?.questionnaire
  return legacy && legacy.enabled === true && Array.isArray(legacy.fields) ? legacy.fields : []
})

/** 活动后问卷题目：仅「双问卷」活动（活动前 + 活动后均启用）时展示，防止旧活动重复出现 */
const postQuestionnaireFields = computed(() => {
  const pre = activity.value?.preQuestionnaire
  const post = activity.value?.questionnaire
  if (!(pre && pre.enabled === true)) return []
  return post && post.enabled === true && Array.isArray(post.fields) ? post.fields : []
})

/** 当前弹层渲染的题目与答案容器（按问卷类型切换） */
const currentQFields = computed(() =>
  questionnaireKind.value === 'post' ? postQuestionnaireFields.value : questionnaireFields.value)
const currentQData = computed(() =>
  questionnaireKind.value === 'post' ? postQuestionnaireData.value : questionnaireData.value)

/** 分步收集：按 step 归组（活动前问卷 1-5；无 step 视为单步） */
const Q_STEP_LABELS: Record<number, string> = {
  1: '基础身份与联系信息', 2: '现状与需求', 3: '痛点与顾虑', 4: '购买决策', 5: '授权许可',
}
const questionnaireStepGroups = computed(() => {
  const groups: { step: number; label: string; fields: any[] }[] = []
  for (const f of currentQFields.value) {
    const s = f.step != null ? Number(f.step) : 0
    const last = groups[groups.length - 1]
    if (!last || last.step !== s) groups.push({ step: s, label: Q_STEP_LABELS[s] || '', fields: [f] })
    else last.fields.push(f)
  }
  return groups
})
const currentStepGroup = computed(() =>
  questionnaireStepGroups.value[questionnaireStep.value] || questionnaireStepGroups.value[0])

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

/** 卡片区待解锁积分（未达成的固定项 +20/+50 之和） */
const benefitPointsLeft = computed(() => {
  return benefitCards.value.reduce((s: number, c: any) => (c.done || c.reward) ? s : s + (Number(c.points) || 0), 0)
})

/** 卡片区展示项：联系方式/活动前问卷/关注 三条固定项 + 活动后问卷 + multi 奖励权益（数据来自 unlockCtx） */
const benefitCards = computed(() => {
  const u = unlockCtx.value || {}
  const contactDone = !!u.contactDone
  const surveyDone = !!u.surveyDone
  const subscribed = !!u.subscribed
  const postSurveyFilled = !!(u.questionnaireData && typeof u.questionnaireData === 'object' && Object.keys(u.questionnaireData).length)
  const postSurveyEnabled = postQuestionnaireFields.value.length > 0
  const list: any[] = [
    { key: 'contact', name: '完善联系方式', points: 20, done: contactDone, desc: contactDone ? '已完善联系方式 +20 已到账' : '补填联系电话 +20 积分' },
    { key: 'survey', name: '活动前问卷', points: 50, done: surveyDone, desc: surveyDone ? '已完成活动前问卷 +50 已到账' : '报名后填写活动前问卷 +50 积分' },
    { key: 'subscribe', name: '关注公众号', points: 50, done: subscribed, desc: subscribed ? '已关注公众号 +50 已到账' : '关注公众号 +50 积分' },
  ]
  if (postSurveyEnabled) {
    list.push({
      key: 'postSurvey',
      name: '活动后问卷',
      points: 0,
      done: postSurveyFilled,
      locked: !u.postSurveyAllowed,
      desc: postSurveyFilled
        ? '活动后问卷已提交'
        : (u.postSurveyAllowed ? '填写活动后问卷，反馈活动体验' : '需签到且活动结束后可填写'),
    })
  }
  const rewards = Array.isArray(u.rewards) ? u.rewards : []
  for (const r of rewards) {
    if (!r || r.mode !== 'multi' || !r.name) continue
    list.push({ key: `reward-${r.id}`, name: r.name, points: 0, done: !!r.unlocked, desc: r.unlocked ? '已解锁' : '完成上方补领项可解锁本权益', reward: true })
  }
  return list
})

/** 权益选择方式文案（reward 步进提示） */
const selectModeHint = computed(() => {
  const mode = unlockStatus.value?.selectMode || 'all'
  if (mode === 'one') return '单选'
  if (mode === 'any') return `任选最多 ${Math.max(1, Number(unlockStatus.value?.selectN) || 1)} 项`
  return '可多选'
})

function toggleQuestionnaireMulti(f: any, o: string) {
  const d = currentQData.value
  const arr = Array.isArray(d[f.key]) ? [...d[f.key]] : []
  const i = arr.indexOf(o)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(o)
  d[f.key] = arr
  // 取消选择「其他」时，同步清理对应填空残留，避免空串答案入库
  if (!arr.includes('其他')) delete d[`${f.key}__other`]
}

/** 「其他」填空：临时输入文本 → 写入 {key}__other；切换选项时清理无效残留 */
const qOtherText = ref<Record<string, string>>({})
function setQOther(f: any) {
  const d = currentQData.value
  const hasOther = (d[f.key] || []).includes('其他')
  const txt = (qOtherText.value[f.key] || '').trim()
  if (hasOther) d[`${f.key}__other`] = txt
  else delete d[`${f.key}__other`]
}

/** 报名引导 info 步的问卷入口：仅记录资料，提交后返回引导（活动前问卷） */
function openFillQuestionnaire() {
  isFillQuestionnaire.value = false
  questionnaireKind.value = 'pre'
  questionnaireStep.value = 0
  showQuestionnaire.value = true
}

/** 报名成功后的补填问卷入口：提交用于解锁 survey 条件权益（活动前问卷） */
function openPostFillQuestionnaire() {
  isFillQuestionnaire.value = true
  questionnaireKind.value = 'pre'
  questionnaireStep.value = 0
  showQuestionnaire.value = true
}

/** 活动后问卷填写入口：需已签到且活动已结束（postSurveyAllowed） */
function openPostQuestionnaire() {
  if (!unlockCtx.value?.postSurveyAllowed) {
    uni.showToast({ title: '需签到且活动结束后可填写活动后问卷', icon: 'none' })
    return
  }
  isFillQuestionnaire.value = true
  questionnaireKind.value = 'post'
  questionnaireStep.value = 0
  showQuestionnaire.value = true
}

/** 报名引导 info 步内提交问卷：数据已经 v-model 绑定，仅关闭并重评引导步进 */
function submitQuestionnaire() {
  const filled = surveyFilledValue()
  showQuestionnaire.value = false
  uni.showToast({ title: filled ? '问卷已记录' : '本次跳过问卷', icon: 'none' })
  goNextGuide()
}

/** 补填问卷：提交后重算解锁并幂等发放新增 multi 权益（pre 驱动解锁/积分；post 仅记录反馈） */
async function submitFillQuestionnaire() {
  if (!signupId.value) return
  const kind = questionnaireKind.value
  uni.showLoading({ title: '提交中...' })
  try {
    const answers = { ...currentQData.value }
    const res = await fillQuestionnaire(signupId.value, answers, kind)
    uni.hideLoading()
    if ((res as any)?.ok) {
      showQuestionnaire.value = false
      if (kind === 'post') {
        await loadSignupUnlock()
        uni.showToast({ title: '活动后问卷已提交', icon: 'success' })
        return
      }
      await loadSignupUnlock()
      triggerFloat()
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

async function onBenefitCard(c: any) {
  if (c.done) return
  if (c.key === 'contact') { showContactFill.value = !showContactFill.value; showSubscribeFill.value = false; return }
  if (c.key === 'survey') { openPostFillQuestionnaire(); return }
  if (c.key === 'postSurvey') { openPostQuestionnaire(); return }
  if (c.key === 'subscribe') {
    showSubscribeFill.value = !showSubscribeFill.value
    showContactFill.value = false
    if (showSubscribeFill.value && !subscribed.value) {
      if (!wxQrcodeUrl.value) await loadFollowQrcode()
      subscribeStartPolling()
    } else {
      subscribeStopPolling()
    }
    return
  }
  uni.showToast({ title: '完成上方补领项可解锁该权益', icon: 'none' })
}

async function submitBenefitContact() {
  if (!signupId.value) return
  const form = { ...contactForm.value }
  const phoneF = formFields.value.find((f: any) => f.type === 'phone')
  if (phoneF && phoneF.required && !String(form[phoneF.key] || '').trim()) {
    uni.showToast({ title: '请填写联系电话', icon: 'none' }); return
  }
  uni.showLoading({ title: '提交中...' })
  try {
    const res = await fillActivityContact(signupId.value, form)
    uni.hideLoading()
    if ((res as any)?.ok) {
      showContactFill.value = false
      signupData.value = { ...signupData.value, ...(form as any) }
      await loadSignupUnlock()
      triggerFloat(20)
      uni.showToast({ title: '联系方式已完善', icon: 'success' })
    } else {
      uni.showToast({ title: '提交失败', icon: 'none' })
    }
  } catch (e) { uni.hideLoading(); uni.showToast({ title: '提交失败', icon: 'none' }) }
}

async function submitBenefitSubscribe() {
  if (!signupId.value) return
  uni.showLoading({ title: '刷新中...' })
  try {
    const res = await claimActivitySubscribe(signupId.value)
    uni.hideLoading()
    if ((res as any)?.subscribed) {
      showSubscribeFill.value = false
      subscribed.value = true
      subscribeStopPolling()
      await loadSignupUnlock()
      triggerFloat()
      uni.showToast({ title: '已领取关注奖励', icon: 'success' })
    } else {
      uni.showToast({ title: '尚未检测到关注，请先关注公众号', icon: 'none' })
    }
  } catch (e) { uni.hideLoading(); uni.showToast({ title: '刷新失败', icon: 'none' }) }
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
const customPromoHtml = computed(() => {
  const v = activity.value?.customPromoHtml
  return v && String(v).trim() ? String(v) : ''
})
// 完全定制是否生效：有定制 HTML 且 active 标记为真（运营端按最后保存方案切换该标记）
const customPromoActive = computed(() => activity.value?.customPromoActive === true)
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
  // 微信授权跳转返回后自动续接报名权益引导（仓储中有本活动待续引导且尚未报名）
  if (!signedUp.value) resumeRewardGuideAfterReturn()
  loadReviews()
  if (activity.value?.status === 'ended' || signedUp.value) loadLearning()
  if (activity.value?.status === 'ended') loadRelated()
}

/** 微信授权回调返回后，自动从上次暂停的引导步骤继续（无需用户再次点报名） */
function resumeRewardGuideAfterReturn() {
  const pending = uni.getStorageSync(REWARD_GUIDE_KEY) as any
  if (!pending || pending.activityId !== id) return
  // 不在此移除：openRewardGuide 内部会读取 pending 恢复 loginAuth 并移除
  openRewardGuide()
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

// 分享裂变：分享可得积分提示 + 我的邀请跳转
const shareTip = ref('')
watch(() => activity.value?.shareRewardPoints, (v: any) => {
  const n = Number(v) || 0
  shareTip.value = n > 0 ? `分享邀请好友报名，每成功邀请 1 人得 ${n} 积分` : ''
}, { immediate: true })

function goMyInvitation() {
  uni.navigateTo({ url: '/pages/activity/my-invitation' })
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

/** 报名入口：统一进入引导向导（微信：login→reward→报名；浏览器：login→reward→info→报名） */
async function onSignup() {
  openRewardGuide()
}

/** 悬浮「去领权益」按钮：仅存在未领取权益时可能展示；滚动到权益区则隐藏，滚出且仍有未领再显示 */
const claimBarVisible = ref(true)
function hasPendingBenefit() {
  return signedUp.value && signupId.value && benefitCards.value.some(c => !c.done)
}
function updateClaimBar() {
  if (!hasPendingBenefit()) { claimBarVisible.value = false; return }
  const newVisible = new Promise<boolean>((resolve) => {
    uni.createSelectorQuery().select('#benefit-section').boundingClientRect((rect: any) => {
      if (!rect) { resolve(true); return }
      const win = (uni.getSystemInfoSync().windowHeight as number) || 667
      // 区域顶部进入可视区上部（<55% 屏高）即视为已到达 → 隐藏按钮
      resolve(!(rect.top >= -80 && rect.top < win * 0.55))
    }).exec()
  })
  newVisible.then(v => { claimBarVisible.value = v })
}
onPageScroll(() => { updateClaimBar() })

/** 悬浮按钮点击：滚动定位到「领取更多权益」卡片区 */
function scrollToBenefit() {
  uni.pageScrollTo({ selector: '#benefit-section', duration: 300 })
}

function usedCapacityOf(a: any): number {
  return Number(a?.usedCapacity ?? a?.used_capacity ?? 0) || 0
}

/** 报名/取消后刷新报名数量（usedCapacity），避免本地状态滞后 */
async function refreshUsedCapacity() {
  try {
    const res = await getActivityDetail(id)
    const uc = usedCapacityOf(res)
    activity.value = activity.value ? { ...activity.value, usedCapacity: uc, capacity: Number(res?.capacity) ?? activity.value.capacity } : (res ?? null)
  } catch (e) {
    console.warn('刷新报名数量失败', e)
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
      refreshUsedCapacity()
      loadSignupUnlock()
      // 报名即到账积分飘分（微信环境常跳过信息环节/奖励菜单走默认勾选，此处统一展示到账总额）
      const previewTotal = (result as any)?.pointsPreview?.total
        || (result as any)?.unlockInfo?.pointsPreview?.total
        || 0
      if (previewTotal > 0) setTimeout(() => triggerFloat(previewTotal), 500)
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
        // 回填 signupId：优先取后端返回，缺省则从我的报名列表兜底，保证「领取更多权益」区可渲染
        if (!signupId.value) {
          signupId.value = Number((result as any)?.signupId) || null
          if (!signupId.value) await restoreSignupIdFromList()
        }
        refreshUsedCapacity()
        loadSignupUnlock()
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
            signupId.value = null
            qrcodeUrl.value = ''
            unlockCtx.value = null
            showContactFill.value = false
            showSubscribeFill.value = false
            uni.showToast({ title: '已取消报名', icon: 'success' })
            refreshUsedCapacity()
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

/** 从我的报名列表查找本活动报名记录（登录态） */
async function findMySignup(): Promise<any> {
  if (!getToken()) return null
  const list = (await myActivities()) as any
  const arr = Array.isArray(list) ? list : []
  return arr.find((r: any) => r?.activity?.documentId === id || r?.activity?.id === id) || null
}

/** 兜底回填 signupId（报名成功/已报名分支共用） */
async function restoreSignupIdFromList() {
  if (signupId.value) return
  try {
    const found = await findMySignup()
    signupId.value = found ? Number(found?.id) || null : null
  } catch (e) {
    signupId.value = null
  }
}

/** 恢复报名状态：若已登录，从我的报名记录判断本活动是否已报名 */
async function restoreSignupState() {
  if (!getToken()) return
  try {
    await restoreSignupIdFromList()
    const found = await findMySignup()
    const st = found?.status
    waitlisted.value = st === 'waiting'
    signedUp.value = st === 'active'
    signupId.value = found ? Number(found?.id) || null : null
    if (waitlisted.value) waitlistPosition.value = Number(found?.position) || waitlistPosition.value
    if (found?.reviewedAt) reviewed.value = true
    if (signedUp.value) nextTick(() => generateQrcode())
    if (signedUp.value) loadSignupUnlock()
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
    refreshShare()
  }
})

onUnmounted(() => {
  subscribeStopPolling()
  if (floatTimer) clearTimeout(floatTimer)
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

/* 完全定制：透明独立呈现层，不套运营端主题背景/配色，背景与风格完全由客户 HTML 决定 */
.promo-custom-wrap { width: 100%; background: transparent; }

.card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.hero-card {
  position: relative;
  overflow: hidden;
  background: var(--c-card, #fff);
}
.hero-card .hero-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 8rpx;
  background: linear-gradient(135deg, var(--c-primary, #c9a24b), var(--c-accent, #c9a24b));
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
  background: var(--c-card, #f6f4ff);
  border: 1rpx solid var(--c-primary, #e8e0ff);
  border-radius: 20rpx;
  padding: 6rpx 18rpx;
  margin-bottom: 14rpx;
}

.series-chip-text {
  font-size: 22rpx;
  color: var(--c-primary, #667eea);
  max-width: 420rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-chip-arrow {
  font-size: 24rpx;
  color: var(--c-accent, #764ba2);
}

.title {
  flex: 1;
  font-size: 36rpx;
  font-weight: 600;
  color: var(--c-text, #333);
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
  padding: 14rpx 0;
}
.info-row + .info-row {
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}

.info-label {
  width: 96rpx;
  font-size: 26rpx;
  font-weight: 500;
  color: var(--c-primary, #999);
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  font-size: 26rpx;
  color: var(--c-text, #333);
  line-height: 1.5;
}

.desc {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}

.desc-title {
  display: flex;
  align-items: center;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--c-primary, #333);
  margin-bottom: 12rpx;
}
.desc-title::before {
  content: '';
  width: 8rpx;
  height: 26rpx;
  border-radius: 4rpx;
  background: var(--c-primary, #333);
  margin-right: 12rpx;
}

.desc-content {
  display: block;
  font-size: 26rpx;
  color: var(--c-text-dim, #666);
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

.share-row {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.share-entry,
.invite-entry {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  border-radius: 16rpx;
  padding: 26rpx 20rpx;
}

.share-entry {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.invite-entry {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.share-entry-title,
.invite-entry-title {
  color: #fff;
  font-size: 30rpx;
  font-weight: 500;
}

.share-entry-sub,
.invite-entry-sub {
  color: rgba(255, 255, 255, 0.85);
  font-size: 22rpx;
}

.share-tip {
  margin-bottom: 20rpx;
  background: #fff7e6;
  border: 1rpx solid #ffe7ba;
  border-radius: 12rpx;
  padding: 16rpx 24rpx;
  font-size: 24rpx;
  color: #d48806;
}

.share-claim-row { margin-bottom: 16rpx; }
.share-claim-btn {
  padding: 20rpx;
  border-radius: 44rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  text-align: center;
  font-size: 30rpx;
  font-weight: 500;
}
.share-claim-btn.disabled { background: #c9c9c9; }
.share-claim-reason {
  margin-top: -6rpx;
  margin-bottom: 16rpx;
  text-align: center;
  font-size: 24rpx;
  color: #999;
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
.signup-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 92rpx;
  padding: 26rpx 20rpx;
  line-height: 1.4;
  background: #fff;
  border: 1rpx solid #e5e5e5;
  border-radius: 12rpx;
  font-size: 28rpx;
}
.signup-textarea { width: 100%; box-sizing: border-box; min-height: 140rpx; border: 1rpx solid #e5e5e5; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; }
.signup-other { margin-top: 12rpx; }
.signup-picker { border: 1rpx solid #e5e5e5; border-radius: 12rpx; padding: 18rpx 20rpx; font-size: 28rpx; color: #333; display: flex; justify-content: space-between; }
.picker-arrow { font-size: 22rpx; color: #999; }
.signup-options { display: flex; flex-wrap: wrap; gap: 16rpx; }
.signup-opt { font-size: 26rpx; color: #666; padding: 10rpx 28rpx; border: 1rpx solid #ddd; border-radius: 28rpx; }
.signup-opt.on { color: #667eea; border-color: #667eea; background: rgba(102,126,234,.08); }
.signup-actions { display: flex; gap: 20rpx; margin-top: 32rpx; }

/* ---- 报名后「领取更多权益」卡片区 ---- */
.benefit-section {
  margin: 24rpx 24rpx 0;
  padding-bottom: 220rpx; /* 给底部 fixed 操作栏留白 */
}
.benefit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.benefit-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2329;
}
.benefit-add {
  font-size: 24rpx;
  color: #fa8c16;
  font-weight: 600;
}
.benefit-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.06);
  &.done { background: #f6ffed; border: 1rpx solid #b7eb8f; }
  &.reward .benefit-ic { background: #fff7e6; color: #fa8c16; }
  &.locked { background: #f7f8fa; }
}
.benefit-ic {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  flex: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.benefit-mid {
  flex: 1;
  min-width: 0;
}
.benefit-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2329;
}
.benefit-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #969aa3;
}
.benefit-state {
  flex: none;
  font-size: 24rpx;
  color: #969aa3;
  font-weight: 600;
  border-radius: 999rpx;
  padding: 10rpx 20rpx;
  line-height: 1;
  &.go {
    color: #667eea;
    background: #eef0ff;
  }
  &.done-tag {
    color: #389e0d;
    background: #f0fdf4;
    border: 1rpx solid #b7eb8f;
  }
  &.wait-tag {
    color: #8c8c99;
    background: #f0f1f3;
    border: 1rpx solid #e0e2e6;
  }
}
.benefit-inline {
  background: #f7f8fa;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.benefit-follow-tip {
  display: block;
  font-size: 26rpx;
  color: #5b6470;
  line-height: 1.5;
}
.benefit-inline-tip {
  display: block;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
  margin-bottom: 20rpx;
}

.signup-btn { flex: 1; text-align: center; padding: 22rpx 0; border-radius: 40rpx; font-size: 30rpx; }
.signup-btn.cancel { background: #f5f5f5; color: #666; }
.signup-btn.submit { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }

/* 报名成功悬浮「领取权益」按钮 */
.claim-float {
  position: fixed;
  right: 30rpx;
  bottom: calc(200rpx + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18rpx 32rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  box-shadow: 0 6rpx 20rpx rgba(102, 126, 234, 0.4);
}

/* 问卷分步收集 */
.signup-step-label {
  display: block;
  font-size: 26rpx;
  color: #667eea;
  font-weight: 600;
  margin-bottom: 20rpx;
  padding: 12rpx 20rpx;
  background: #f4f6ff;
  border-radius: 12rpx;
}
.signup-step-nav {
  display: flex;
  gap: 16rpx;
  justify-content: center;
  margin-top: 24rpx;
}
.signup-step-dot {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #eef0f4;
  color: #969aa3;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  &.on {
    background: #667eea;
    color: #fff;
  }
}

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
.guide-reward-body { width: 100%; max-height: 46vh; }

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

/* 报名前「报名奖励」清单弹层（必得区 + 解锁区） */
.reward-preview-panel { padding-bottom: calc(32rpx + env(safe-area-inset-bottom)); }
/* 解锁通道提示条 */
.reward-preview-channel {
  display: flex; align-items: center; gap: 12rpx;
  padding: 16rpx 20rpx; margin-bottom: 20rpx;
  background: #fff7ec; border: 1rpx solid #ffe1b3; border-radius: 12rpx;
}
.reward-preview-channel-title {
  font-size: 22rpx; color: #fff; background: #fa8c16; border-radius: 6rpx;
  padding: 2rpx 12rpx; flex-shrink: 0;
}
.reward-preview-channel-value { font-size: 24rpx; font-weight: 500; color: #8a4d0a; flex: 1; min-width: 0; }
.reward-preview-checked { font-size: 22rpx; color: #389e0d; flex-shrink: 0; }
.reward-preview-sec-title {
  display: flex; align-items: center; gap: 12rpx;
  font-size: 26rpx; font-weight: 600; color: #333;
  margin: 8rpx 0 16rpx;
  padding-left: 16rpx;
  border-left: 6rpx solid #667eea;
}
/* 解锁区标题用橙色描边，与必得区（紫）区分 */
.reward-preview-sec-title.unlock { border-left-color: #fa8c16; }
.reward-preview-hint { font-size: 22rpx; font-weight: 400; color: #fa8c16; }
.reward-preview-row {
  display: flex; align-items: center; gap: 16rpx;
  padding: 20rpx; border: 1rpx solid #eee; border-radius: 12rpx; margin-bottom: 12rpx;
  &.done { background: #f6ffed; border-color: #d9f7be; }
  &.locked { background: #fafafa; }
}
.reward-preview-lock { width: 44rpx; font-size: 28rpx; text-align: center; flex-shrink: 0; &.ok { color: #52c41a; } &.todo { color: #fa8c16; } }
.reward-preview-main { display: flex; flex-direction: column; gap: 6rpx; flex: 1; min-width: 0; }
.reward-preview-name { font-size: 28rpx; color: #333; word-break: break-all; }
.reward-preview-cond { font-size: 22rpx; color: #a06a1a; background: #fff7e6; padding: 2rpx 10rpx; border-radius: 6rpx; align-self: flex-start; }
.reward-preview-right { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.reward-preview-state { font-size: 22rpx; padding: 4rpx 14rpx; border-radius: 999rpx; &.ok { color: #389e0d; background: #f0ffe4; } &.todo { color: #fa8c16; background: #fff3e0; } }
.reward-preview-val { font-size: 28rpx; font-weight: 700; color: #fa8c16; flex-shrink: 0; }

.rpc-grid { display: flex; flex-wrap: wrap; gap: 20rpx;
  .rpc-card { position: relative; width: calc(50% - 10rpx); box-sizing: border-box; background: #f7f8fa;
    border: 1rpx solid #eceef1; border-radius: 16rpx; padding: 20rpx; display: flex; flex-direction: column;
    align-items: flex-start; gap: 6rpx;
    &.must { background: linear-gradient(135deg, #667eea, #764ba2); border: none; }
    &.must .rpc-name, &.must .rpc-val, &.must .rpc-meta { color: #fff; }
    &.must .rpc-state.ok { color: #fff; background: rgba(255,255,255,.24); }
    &.locked { opacity: .88; }
    &.done { background: #f0f9f4; border-color: #cdeedb; }
  }
  /* 图标徽标：色彩块 + 类型字，替代 emoji（Windows 桌面不显示 emoji 字体） */
  .rpc-ico { width: 44rpx; height: 44rpx; border-radius: 10rpx; display: flex; align-items: center; justify-content: center;
    font-size: 24rpx; font-weight: 600; color: #fff; line-height: 1; flex-shrink: 0;
    &.ic-pts { background: linear-gradient(135deg, #f6b93b, #e58e26); }
    &.ic-coup { background: linear-gradient(135deg, #ff6b6b, #ee5253); }
    &.ic-ctr { background: linear-gradient(135deg, #48dbfb, #0abde3); }
    &.ic-cou { background: linear-gradient(135deg, #5f27cd, #341f97); }
    &.ic-art { background: linear-gradient(135deg, #1dd1a1, #10ac84); }
    &.ic-def { background: linear-gradient(135deg, #8395a7, #576574); }
  }
  .rpc-lock { position: absolute; top: 16rpx; right: 16rpx; font-size: 26rpx; &.todo { color: #fa8c16; } &.ok { color: #52c41a; } }
  .rpc-name { font-size: 26rpx; font-weight: 500; color: #333; width: 100%; box-sizing: border-box; padding-right: 52rpx; }
  .rpc-meta { font-size: 20rpx; color: #666; }
  .rpc-cond { font-size: 20rpx; color: #a06a1a; background: #fff7e6; border-radius: 6rpx; padding: 2rpx 10rpx; }
  .rpc-state { font-size: 20rpx; padding: 2rpx 12rpx; border-radius: 999rpx; &.ok { color: #389e0d; background: #e6f7e6; } &.todo { color: #b26a00; background: #fff7e6; } }
  .rpc-val { font-size: 26rpx; font-weight: 700; color: #fa8c16; }
  .rpc-row { width: 100%; display: flex; justify-content: flex-end; align-items: center; gap: 12rpx; }
  .rpc-expand { width: 100%; font-size: 22rpx; color: #444; background: #f0f2f5; border-radius: 8rpx; padding: 10rpx 12rpx; box-sizing: border-box; }
}

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

/* ---- 关注公众号二维码 ---- */
.benefit-follow-qr { display: flex; justify-content: center; align-items: center; padding: 16rpx 0; }
.benefit-follow-img { width: 320rpx; height: 320rpx; }
.benefit-follow-empty { color: #999; font-size: 24rpx; }

/* ---- +50 飘分动画 ---- */
.benefit-float {
  position: fixed; left: 50%; top: 32%; transform: translateX(-50%);
  z-index: 200; opacity: 0; pointer-events: none;
}
.benefit-float.show { opacity: 1; animation: floatUp 3s ease forwards; }
.benefit-float-text {
  display: inline-block; padding: 22rpx 52rpx; border-radius: 999rpx;
  background: #ffe9a8; color: #9a6b00; font-size: 46rpx; font-weight: 700;
  box-shadow: 0 8rpx 28rpx rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}
@keyframes floatUp {
  0% { transform: translateX(-50%) translateY(0); opacity: 0; }
  12% { transform: translateX(-50%) translateY(-16rpx); opacity: 1; }
  100% { transform: translateX(-50%) translateY(-320rpx); opacity: 0; }
}
</style>