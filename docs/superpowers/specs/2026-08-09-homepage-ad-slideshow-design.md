# 首页广告幻灯片设计文档

> 日期: 2026-08-09
> 状态: 已批准

## 1. 概述

在 strapi-course 首页（`pages/index/index.vue`）头部区域和搜索栏之间插入广告幻灯片，复用已有的 `ad-banner.vue` 组件，通过后端种子数据初始化 2 条轮播广告内容，并验证全链路可用性。

### 现有系统状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 后端 ad-zone schema | 已就绪 | position 枚举包含 `home-banner`，displayMode 包含 `slideshow` |
| 后端 ad-content schema | 已就绪 | contentType 包含 `slideshow`，images 为 JSON 数组，支持 linkType/linkUrl |
| 后端 ad service/controller | 已就绪 | `getZoneByPosition` 过滤 isActive + 日期范围 + displayMode 逻辑 |
| 后端 API 路由 | 已就绪 | 公开路由 `GET /v1/ads/zones/:position`，管理路由 CRUD |
| 前端 ad-banner.vue | 已就绪 | 支持 slideshow 模式 swiper 轮播，空内容不渲染 |
| 前端 ad-api.ts | 已就绪 | `getAdZone(position)` 调用后端 API |
| 管理后台 ad-zone/ad-content 页面 | 已就绪 | list.vue + edit.vue 均已实现 |
| 后端 bootstrap.ts 种子数据 | 缺失 | 当前仅种子化海报模板，无广告数据 |
| 前端首页集成 | 缺失 | index.vue 未引用 ad-banner 组件 |

## 2. 方案选择

### 方案 A：复用现有 ad-banner 组件（选定）

在首页 `index.vue` 头部和搜索栏之间直接插入 `<ad-banner position="home-banner" />`，在 `bootstrap.ts` 中新增广告种子函数。

- 优点：零新建组件，复用全功能 ad-banner（支持轮播、点击跳转、空内容隐藏、加载状态）
- 缺点：无
- 改动量：前端 1 文件 + 后端 1 文件 + 2 张默认图片

### 方案 B：新建首页专用广告组件（未选）

创建 `home-ad-banner.vue` 专用于首页。

- 缺点：代码重复，违反 DRY，维护成本高

### 方案 C：首页内联广告逻辑（未选）

在 `index.vue` 中直接写广告获取和渲染逻辑。

- 缺点：逻辑耦合，不可复用，维护困难

## 3. 数据模型

### 3.1 广告区域（ad-zone）种子数据

| 字段 | 值 | 说明 |
|------|------|------|
| name | 课程首页 | 管理后台显示名称 |
| code | course-home-banner | 唯一标识码 |
| position | home-banner | 枚举值，前端通过此字段查询 |
| displayMode | slideshow | 轮播模式，返回全部内容 |
| isActive | true | 启用状态 |
| suggestedWidth | 750 | 建议宽度（rpx） |
| suggestedHeight | 300 | 建议高度（rpx） |
| site | 关联到默认站点 | 通过 domain 查询 site-config 获取 |

### 3.2 广告内容 1 种子数据

| 字段 | 值 | 说明 |
|------|------|------|
| name | 精选好课推广 | 管理后台显示名称 |
| contentType | slideshow | 内容类型：轮播 |
| title | 精选好课 限时免费 | 轮播图片上显示的标题文字 |
| images | `["/uploads/ads/banner-courses.jpg"]` | 图片 URL 数组 |
| linkType | internal | 内部链接 |
| linkUrl | /pages/index/index | 链接默认首页 |
| isActive | true | 启用状态 |
| sortOrder | 0 | 排序 |
| priority | 10 | 优先级 |
| slideshowAutoplay | true | 自动播放 |
| slideshowInterval | 4000 | 轮播间隔 4 秒 |
| slideshowLoop | true | 循环播放 |
| slideshowShowDots | true | 显示指示点 |

### 3.3 广告内容 2 种子数据

| 字段 | 值 | 说明 |
|------|------|------|
| name | 积分奖励推广 | 管理后台显示名称 |
| contentType | slideshow | 内容类型：轮播 |
| title | 学习赚积分 成长看得见 | 轮播图片上显示的标题文字 |
| images | `["/uploads/ads/banner-points.jpg"]` | 图片 URL 数组 |
| linkType | internal | 内部链接 |
| linkUrl | /pages/index/index | 链接默认首页 |
| isActive | true | 启用状态 |
| sortOrder | 1 | 排序 |
| priority | 5 | 优先级 |
| slideshowAutoplay | true | 自动播放 |
| slideshowInterval | 4000 | 轮播间隔 4 秒 |
| slideshowLoop | true | 循环播放 |
| slideshowShowDots | true | 显示指示点 |

### 3.4 标题文字推荐理由

- **"精选好课 限时免费"**：突出课程品质和免费属性，吸引用户点击浏览课程列表，与首页课程列表形成呼应
- **"学习赚积分 成长看得见"**：呼应首页积分展示区域，强化平台"学习+积分"双核心价值主张

## 4. 前端集成

### 4.1 首页改动（`pages/index/index.vue`）

在头部区域 `</view>`（header 闭合标签）和搜索栏 `<view class="search-bar">` 之间插入：

```vue
<!-- 广告幻灯片 -->
<ad-banner position="home-banner" />
```

组件引入方式（uni-app easycom 自动引入，无需手动 import）：
- 组件路径：`components/ad-banner/ad-banner.vue`
- 使用位置：`<ad-banner position="home-banner" />`

### 4.2 组件行为说明（无需修改）

`ad-banner.vue` 已内置以下逻辑：

1. **加载状态**：`loading=true` 时显示 spinner，使用 zone.suggestedHeight 撑起占位
2. **空内容隐藏**：`v-else-if="visibleContents.length > 0"` 控制，无内容时不渲染任何 DOM
3. **轮播渲染**：`contentType === 'slideshow'` 时使用 `<swiper>` 组件渲染 images 数组
4. **点击跳转**：`linkType === 'internal'` 时调用 `uni.navigateTo` 跳转 linkUrl
5. **指示点**：`slideshowShowDots !== false && images.length > 1` 时显示底部圆点

### 4.3 条件显示逻辑

```
首页加载 → ad-banner onMounted → getAdZone("home-banner")
  → 后端过滤 isActive=true 的 zone
    → zone 不存在或 isActive=false → 返回 { zone: null, contents: [] }
      → visibleContents.length === 0 → 不渲染任何节点 ✓
    → zone 存在但无 active 内容 → contents 为空
      → visibleContents.length === 0 → 不渲染任何节点 ✓
    → zone 存在且有 active 内容 → 渲染轮播 ✓
```

## 5. 后端种子数据

### 5.1 种子函数（`bootstrap.ts` 新增）

在 `bootstrap.ts` 中新增 `seedAdData` 函数：

1. 查询默认站点（domain=localhost 或第一个站点）
2. 检查 code=`course-home-banner` 的 ad-zone 是否已存在
3. 若不存在，创建 ad-zone + 2 条 ad-content
4. 若已存在，跳过（幂等）

### 5.2 默认图片

生成 2 张 banner 图片，保存到 Strapi 的 public/uploads/ads/ 目录：
- `banner-courses.jpg`：课程学习主题，紫色渐变背景，书籍/学习元素
- `banner-points.jpg`：积分奖励主题，金色/暖色调，积分/成长元素
- 尺寸：750x300 像素（2.5:1 宽高比，适合移动端 banner）

## 6. 验证计划

### 6.1 后端数据验证

1. 启动 Strapi，检查控制台日志确认种子函数执行成功
2. `GET http://localhost:1337/api/zhao-studio/v1/ads/zones/home-banner` 确认返回 zone + 2 条 contents

### 6.2 管理后台验证

1. 访问 strapi-backend 管理后台广告区域列表页，确认"课程首页"区域存在
2. 编辑广告区域，修改 isActive 或 displayMode，保存成功
3. 访问广告内容列表页，确认 2 条内容存在
4. 编辑广告内容，修改 title 或 images，保存成功

### 6.3 前端 C 端验证

1. 启动 strapi-course 前端，打开首页
2. 确认头部和搜索栏之间显示广告轮播图
3. 确认轮播自动播放、指示点显示、点击跳转首页

### 6.4 条件显示验证

1. 在管理后台关闭广告区域（isActive=false）
2. 刷新前端首页，确认广告幻灯片不显示
3. 在管理后台重新启用，刷新确认恢复显示
4. 删除所有广告内容，刷新确认广告区域不显示

## 7. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `strapi-course/pages/index/index.vue` | 修改 | 在 header 和 search-bar 之间插入 `<ad-banner position="home-banner" />` |
| `strapi/plugins/zhao-studio/server/src/bootstrap.ts` | 修改 | 新增 `seedAdData` 函数并调用 |
| `strapi/public/uploads/ads/banner-courses.jpg` | 新增 | 默认广告图片 1 |
| `strapi/public/uploads/ads/banner-points.jpg` | 新增 | 默认广告图片 2 |

## 8. 不涉及的范围

- 不修改 ad-zone / ad-content schema（已满足需求）
- 不修改 ad service / controller / routes（已满足需求）
- 不修改 ad-banner.vue 组件（已满足需求）
- 不修改 ad-api.ts（已满足需求）
- 不修改管理后台 ad-zone / ad-content 页面（已满足需求）
