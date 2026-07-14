# 圣麟教育 - 视频学习答题积分应用

## 项目简介
这是一个基于 uni-app + Vue3 + TypeScript 开发的视频学习答题应用，用户可以通过观看课程视频学习知识，完成答题获得积分，并使用积分兑换商品。

## 技术栈
- 前端框架：uni-app + Vue 3
- 编程语言：TypeScript
- UI样式：SCSS
- 状态管理：Vue 3 Composition API (ref/computed)

## 项目结构
```
shao/
├── pages/                      # 页面目录
│   ├── index/                 # 全部课程首页
│   ├── course-detail/         # 课程详情页
│   ├── my-course/             # 我的课程页
│   ├── video-player/          # 视频播放学习页
│   ├── quiz/                  # 独立答题页
│   ├── exchange/              # 积分兑换中心
│   ├── points-record/         # 积分记录页
│   ├── redeem-record/         # 兑换记录页
│   └── profile/               # 用户中心页
├── services/                  # API服务
│   └── api.ts                # API接口定义
├── utils/                     # 工具函数
│   ├── storage.ts            # 本地存储管理
│   └── env.ts                # 环境变量
├── static/                    # 静态资源
├── pages.json                # 页面路由配置
├── manifest.json             # 应用配置
├── App.vue                   # 应用入口
└── main.js                   # 主入口文件
```

## 核心功能

### 1. 课程相关
- **全部课程**：展示所有可学习的课程列表，支持搜索和分类过滤
- **课程详情**：展示课程信息、课时列表，可选择开始学习
- **我的课程**：展示用户已学习的课程，显示学习进度
- **视频播放**：模拟视频播放，展示播放进度，支持切换课时

### 2. 答题相关
- **课时答题**：每个课时学习完成后需完成2道或以上题目
- **答题积分**：答题正确率≥60%可获得积分（每题10分，上限30分）
- **每日限制**：每日最多3次答题获得积分的机会
- **错误重试**：正确率不足60%需重新学习课时

### 3. 积分相关
- **积分余额**：显示当前积分余额
- **积分记录**：查看积分获得和消费明细
- **积分兑换**：使用积分兑换商品
- **兑换记录**：查看历史兑换订单

### 4. 用户相关
- **用户中心**：个人信息展示，功能导航
- **退出登录**：安全退出功能

## API接口说明

所有API接口基于后端插件文档开发，包含：

### 课程模块 (zhao-course)
- `getCourseList()` - 获取课程列表
- `getCourseDetail(id)` - 获取课程详情
- `getLessonList(courseId)` - 获取课时列表
- `getLessonDetail(id)` - 获取课时详情
- `submitLessonProgress()` - 提交学习进度
- `claimLessonPoints()` - 领取课时积分

### 测验模块 (zhao-quiz)
- `getQuizByLesson(lessonId)` - 获取课时题目
- `submitQuizAnswer()` - 提交答题答案
- `getQuizRecord()` - 获取答题记录

### 积分模块 (zhao-point)
- `getPointBalance()` - 获取积分余额
- `getPointRecordList()` - 获取积分记录
- `earnPoints()` - 发放积分
- `getPointProductList()` - 获取商品列表
- `getPointProductDetail()` - 获取商品详情
- `redeemPoints()` - 兑换商品
- `getRedemptionRecordList()` - 获取兑换记录

## 使用说明

### 1. 项目运行
需要在支持 uni-app 的开发环境中运行，如 HBuilderX 或使用 CLI 工具。

### 2. 学习流程
1. 在"全部课程"浏览课程
2. 点击课程进入详情页
3. 点击开始学习进入视频播放页
4. 观看视频（或点击播放模拟学习）
5. 完成学习后开始答题
6. 答题完成获得积分（正确率≥60%）

### 3. 积分兑换
1. 在"积分兑换"浏览商品
2. 点击商品查看详情
3. 填写收货信息
4. 点击确认兑换
5. 在"兑换记录"查看订单状态

## 开发说明

### 数据模拟
为了方便开发和测试，所有API都包含了模拟数据，在接口调用失败时会自动使用模拟数据展示效果。

### 本地存储
使用 `utils/storage.ts` 管理本地存储，包括：
- token - 登录令牌
- user - 用户信息
- points - 积分余额

## 核心页面说明

### pages/index/index.vue - 全部课程
展示课程列表，支持搜索和分类筛选，点击课程跳转到详情页。

### pages/course-detail/course-detail.vue - 课程详情
展示课程信息和课时列表，可选择不同课时开始学习。

### pages/video-player/video-player.vue - 视频播放
模拟视频播放，展示播放进度，完成学习后可开始答题。包含答题弹窗，支持多题作答。

### pages/exchange/exchange.vue - 积分兑换
展示可兑换商品，支持选择商品填写收货信息进行兑换。

### pages/profile/profile.vue - 用户中心
用户信息展示，提供功能导航入口，包括我的课程、积分兑换、兑换记录等。

## 更新日志

### 2026-06-03
- 新增课程详情页，完善学习流程
- 添加收货信息填写功能
- 修复答题选项遍历逻辑
- 完善API接口调用
- 优化页面跳转逻辑
