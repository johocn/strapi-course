# 海报模板编辑器增强与渲染优先级重构

> 日期：2026-08-09
> 状态：待审批

## 一、问题背景

当前海报系统存在以下问题：

1. **编辑器缺少图片上传能力**：海报模板编辑页（`/pages/studio/poster-template/edit`）的背景图片和图片元素只能手动输入 URL，无法上传图片，导致自定义海报功能形同虚设
2. **渲染优先级不合理**：变量元素当前优先级为「页面变量 > 模板 defaultValue」，这意味着即使在编辑器中配置了值，也会被页面传入的 site-config 数据覆盖，编辑器失去「主配置」地位
3. **兜底数据不完整**：用户未登录时没有昵称和头像，当前硬编码兜底值（如 `'好友推荐'`）无法按租户自定义
4. **requiredVariables 校验与新逻辑冲突**：优先级翻转后，defaultValue 可替代变量，但 requiredVariables 校验在变量解析之前执行，仍会抛错导致海报生成失败
5. **编辑器元素类型标注不清晰**：无法直观区分哪些元素是前端传值、哪些是固定内容

## 二、设计目标

- 海报模板编辑器成为海报配置的主入口，支持图片上传
- 渲染优先级：编辑器配置 > 前端实时数据 > site-config 兜底 > 前端内置模板兜底 > 跳过
- 租户配置页新增海报兜底字段，支持按租户自定义默认用户名/头像/推荐语
- 编辑器清晰标注变量元素与固定元素，提供变量来源参考表
- 移除 requiredVariables 运行时校验，保留为编辑器 UI 用途

## 三、架构设计

### 3.1 渲染优先级链（三层兜底）

**变量元素**（`isVariable: true`）：

```
1. 模板 defaultValue（编辑器配置）        → 非空则优先
2. 页面 variable（实时数据 + site-config 兜底）→ defaultValue 为空时
3. 前端内置模板 defaultValue（poster-templates.ts，按 elementKey 匹配）→ 都为空时
4. 仍为空 → 跳过不绘制，不报错
```

**固定元素**（`isVariable: false`）：

```
1. 模板 content（编辑器配置）              → 非空则绘制
2. 前端内置模板 content（poster-templates.ts，按 elementKey 匹配）→ content 为空时
3. 仍为空 → 跳过不绘制，不报错
```

**关键原则**：
- 兜底仅补全 `resolvedContent`（文字内容/图片 URL），不补全样式属性（位置、颜色、字体等完全由后端模板决定）
- 内置模板按 `elementKey` 匹配，后端新增的元素（内置模板中没有的）不获得兜底
- 内置模板中有的元素但后端模板没定义的，不会凭空添加

### 3.2 优先级翻转逻辑

**翻转前**（当前）：
```typescript
resolvedContent = variables[varName] ?? (defaultValue || '')
//          页面变量优先              模板默认值兜底
```

**翻转后**：
```typescript
resolvedContent = defaultValue || variables[varName] || ''
//          模板默认值优先              页面变量兜底
```

**为什么对动态元素无影响**：seed 数据中所有变量元素的 `defaultValue` 初始为空字符串 `''`，空字符串在 `||` 运算中是 falsy 会被跳过，页面变量自然生效。只有当用户在编辑器中主动设置了非空值时，翻转才生效。

### 3.3 requiredVariables / optionalVariables 调整

- **移除运行时校验**：删除 `resolveTemplate` 中的 POSTER_002 校验逻辑
- **保留为 UI 用途**：在编辑器中作为变量下拉选项的数据源和来源提示表的依据
- **变量缺失行为**：变量未传且 defaultValue 为空 → 靠内置模板兜底 → 仍为空则跳过，不报错

## 四、详细设计

### 4.1 新增 site-config 字段

在 `site-config` schema 中新增 3 个字段：

| 字段名 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `posterDefaultUserName` | string | maxLength: 50 | 海报默认用户名 |
| `posterDefaultUserAvatar` | media | multiple: false, allowedTypes: images | 海报默认用户头像 |
| `posterDefaultRecommendReason` | string | maxLength: 200 | 海报默认推荐理由 |

命名约定：camelCase，与现有 `siteName`、`shareImage` 等保持一致。

### 4.2 公开配置 API 扩展

`getPublicConfig` 返回的 `data.site` 对象新增 3 个字段：

```typescript
{
  siteName: string,
  siteDescription: string,
  logo: MediaObject | undefined,
  shareImage: MediaObject | undefined,
  // 新增
  posterDefaultUserName: string,
  posterDefaultUserAvatar: MediaObject | undefined,
  posterDefaultRecommendReason: string,
}
```

**具体修改位置**（`config.ts` → `getPublicConfig`）：

1. **`PUBLIC_FIELDS` 数组**：追加 `"posterDefaultUserName"` 和 `"posterDefaultRecommendReason"`（字符串字段，走通用循环）

```typescript
const PUBLIC_FIELDS = [
  "siteName", "siteDescription", "seoKeywords", "seoDescription",
  "tencentMapKey", "shareTitle", "shareDescription", "icpNumber",
  "customerServiceUrl", "domain",
  // 新增
  "posterDefaultUserName", "posterDefaultRecommendReason",
];
```

2. **媒体字段单独处理**：在 `logo` / `favicon` / `shareImage` 之后追加 `posterDefaultUserAvatar`

```typescript
if (fullConfig?.logo) sitePublic.logo = fullConfig.logo;
if (fullConfig?.favicon) sitePublic.favicon = fullConfig.favicon;
if (fullConfig?.shareImage) sitePublic.shareImage = fullConfig.shareImage;
// 新增
if (fullConfig?.posterDefaultUserAvatar) sitePublic.posterDefaultUserAvatar = fullConfig.posterDefaultUserAvatar;
```

3. **默认配置（siteId 为 null 时的兜底返回）**：在 `site` 对象中追加 3 个空值字段

```typescript
site: {
  siteName: "", siteDescription: "", logo: "", favicon: "",
  shareTitle: "", shareDescription: "", shareImage: "",
  sharePath: "/pages/index/index", domain: "",
  // 新增
  posterDefaultUserName: "", posterDefaultUserAvatar: "",
  posterDefaultRecommendReason: "",
},
```

### 4.3 AuthConfig 接口扩展

```typescript
export interface AuthConfig {
  // ... 现有字段 ...

  // 海报兜底配置（新增）
  posterDefaultUserName: string
  posterDefaultUserAvatar: string  // resolveMediaUrl 后的 URL
  posterDefaultRecommendReason: string
}
```

`fetchAuthConfig` 中新增字段解析：
- `posterDefaultUserName`：直接取 `data.site?.posterDefaultUserName`
- `posterDefaultUserAvatar`：经 `resolveMediaUrl()` 转换为 URL 字符串
- `posterDefaultRecommendReason`：直接取 `data.site?.posterDefaultRecommendReason`

### 4.4 租户配置页表单（tenant/detail.vue）

在「分享设置」分区后新增「海报兜底配置」分区：

| 表单字段 | 控件 | 说明文字 |
|---|---|---|
| 海报默认用户名 | input | 当用户未登录或未设置昵称时，课程推荐/积分兑换海报中显示的默认用户名 |
| 海报默认用户头像 | MediaPicker | 当用户未登录或未设置头像时，海报中显示的默认头像图片 |
| 海报默认推荐理由 | input | 当课程/商品没有描述信息时，海报中显示的默认推荐语 |

保存逻辑：加入 `SCHEMA_FIELDS` 集合，媒体字段按 `xxxId` + `xxxUrl` 双字段管理，保存时提交媒体 ID。

### 4.5 海报模板编辑器增强（poster-template/edit.vue）

#### 4.5.1 背景图片上传

将 `backgroundImage` 的纯文本输入框替换为：
- MediaPicker 触发按钮
- 缩略图预览（已选图片时）
- 清除按钮

#### 4.5.2 图片元素上传

在元素编辑表单中，当 `elementType === 'image'` 时：
- `isVariable: false`（固定图片）：上传按钮 → URL 填入 `content` 字段，始终生效
- `isVariable: true`（变量图片）：上传按钮 → URL 填入 `defaultValue` 字段，作为优先值

#### 4.5.3 元素列表标识徽章

每个元素旁边显示类型标识：
- 变量元素 → 蓝色徽章 `变量: {variableName}`
- 固定元素 → 灰色徽章 `固定`

#### 4.5.4 variableName 下拉选择

当 `isVariable` 开启时，`variableName` 从模板的 `requiredVariables` + `optionalVariables` 中选择（下拉菜单），不再自由文本输入。杜绝拼写错误。

#### 4.5.5 变量来源提示表

在元素编辑区域展示参考表，标注每个模板 code 对应的前端传值变量及来源：

| 模板 | 变量名 | 类型 | 前端来源 | 是否必填 |
|---|---|---|---|---|
| brand_share | `title` | text | 站点名称 (siteConfig.siteName) | 必填 |
| brand_share | `values` | text | 站点描述 (siteConfig.siteDescription) | 必填 |
| brand_share | `main_image` | image | 站点分享图 (siteConfig.shareImage) | 必填 |
| brand_share | `logo` | image | 站点 Logo (siteConfig.logo) | 可选 |
| course_share | `user_name` | text | 用户昵称 → 海报默认用户名 | 必填 |
| course_share | `user_avatar` | image | 用户头像 → 海报默认用户头像 | 可选 |
| course_share | `course_image` | image | 课程封面 (course.coverUrl) | 必填 |
| course_share | `recommend_reason` | text | 课程描述 → 海报默认推荐理由 | 可选 |
| product_share | `user_name` | text | 同 course_share | 必填 |
| product_share | `user_avatar` | image | 同 course_share | 可选 |
| product_share | `product_image` | image | 商品图片 | 必填 |
| product_share | `product_name` | text | 商品名称 | 必填 |
| product_share | `product_price` | text | 商品价格 | 必填 |
| product_share | `recommend_reason` | text | 商品描述 → 海报默认推荐理由 | 可选 |

#### 4.5.6 isVariable 字段说明文字

```
☑ 变量元素
此元素的值由前端页面动态传入。在编辑器中设置的值作为优先值（非空时优先生效），
前端页面传入的值作为兜底。适用于需要动态内容的元素（如用户名、课程封面）。

☐ 固定元素
此元素始终使用在此设置的值，不受前端页面影响。
适用于静态内容（如底部提示文字、装饰性色块）。
```

### 4.6 渲染优先级翻转实现

#### 4.6.1 后端解析器（poster.ts `resolveTemplate`）

```typescript
// 翻转前
resolved.resolvedContent = variables[element.variableName] ?? (element.defaultValue || '');

// 翻转后
resolved.resolvedContent = element.defaultValue || variables[element.variableName] || '';
```

同时移除 requiredVariables 校验逻辑（POSTER_002 错误）。

#### 4.6.2 本地解析器（poster-templates.ts `resolveTemplateLocal`）

```typescript
// 翻转前
resolved.resolvedContent = variables[element.variableName] ?? (element.defaultValue || '');

// 翻转后
resolved.resolvedContent = element.defaultValue || variables[element.variableName] || '';
```

#### 4.6.3 内置模板兜底（share-poster.vue `fetchRenderData`）

需在 `share-poster.vue` 中新增 `BUILTIN_TEMPLATES` 导入（当前仅导入了 `resolveTemplateLocal`）：

```typescript
import { resolveTemplateLocal, BUILTIN_TEMPLATES } from '@/utils/poster-templates'
```

后端 API 返回结果后、交给渲染器前，对 `resolvedContent` 为空的元素做内容补全：

```typescript
const builtin = BUILTIN_TEMPLATES[templateCode]
if (builtin) {
  apiResult.elements.forEach(el => {
    if (!el.resolvedContent) {
      const builtinEl = builtin.elements.find(e => e.elementKey === el.elementKey)
      if (builtinEl) {
        el.resolvedContent = el.isVariable
          ? (builtinEl.defaultValue || '')
          : (builtinEl.content || '')
      }
    }
  })
}
```

### 4.7 页面变量构建（profile.vue / course-detail.vue / exchange/detail.vue）

#### profile.vue（brand_share 模板）

```typescript
const posterConfig = computed(() => ({
  templateCode: 'brand_share',
  pagePath: 'pages/index/index',
  variables: {
    title: siteConfig?.siteName || '',
    values: siteConfig?.siteDescription || '',
    main_image: resolveMediaUrl(siteConfig?.shareImage) || '',
    logo: resolveMediaUrl(siteConfig?.logo) || '',
  },
}))
```

注意：页面变量不再带硬编码默认值（如 `'圣麟教育'`），改为空字符串。兜底由模板 defaultValue 和内置模板处理。

#### course-detail.vue（course_share 模板）

```typescript
const posterConfig = computed(() => {
  const user = getUser()
  return {
    templateCode: 'course_share',
    pagePath: `pages/course-detail/course-detail?id=${course.value?.documentId || ''}`,
    variables: {
      user_name: user?.nickname || user?.name || siteConfig?.posterDefaultUserName || '',
      user_avatar: user?.avatar
        ? getImageUrl(user.avatar)
        : resolveMediaUrl(siteConfig?.posterDefaultUserAvatar) || '',
      course_image: course.value?.coverUrl ? getImageUrl(course.value.coverUrl) : '',
      recommend_reason: course.value?.description || siteConfig?.posterDefaultRecommendReason || '',
    },
  }
})
```

变量构建中的兜底链：实时数据 → site-config 兜底字段 → 空字符串。

#### exchange/detail.vue（product_share 模板）

```typescript
const posterConfig = computed(() => {
  if (!product.value) return {}
  const user = getUser()
  return {
    templateCode: 'product_share',
    pagePath: `pages/exchange/detail?id=${productId.value}`,
    variables: {
      user_name: user?.nickname || user?.name || siteConfig?.posterDefaultUserName || '',
      user_avatar: user?.avatar
        ? getImageUrl(user.avatar)
        : resolveMediaUrl(siteConfig?.posterDefaultUserAvatar) || '',
      product_image: product.value.coverImageUrl || '',
      product_name: product.value.name || '',
      product_price: priceLabel.value || '',
      recommend_reason: product.value.description || siteConfig?.posterDefaultRecommendReason || '',
    },
  }
})
```

注意：移除原有的硬编码默认值（`'好友'`、`'精品商品'`、`'0 积分'`），改为空字符串。兜底由模板 defaultValue 和内置模板处理。

## 五、数据流

```
用户点击「生成海报」
    ↓
share-poster.vue: buildVariables()
    → 合并页面 variables + qr_code + invite_code
    ↓
share-poster.vue: fetchRenderData(templateCode, variables)
    ├─ 1. 调用后端 API: POST /posters/render { templateCode, variables }
    │     → 后端 resolveTemplate: defaultValue || variable || ''
    │     → 返回 resolvedElements（含 resolvedContent）
    │
    ├─ 2. 内置模板兜底: 对 resolvedContent 为空的元素
    │     → 从 BUILTIN_TEMPLATES 按 elementKey 查找
    │     → 变量元素用 defaultValue，固定元素用 content
    │
    └─ 3. 后端不可用时: resolveTemplateLocal（本地解析，同优先级逻辑）
    ↓
PosterRenderer.render(ctx, template, elements)
    → 按 zIndex/sortOrder 排序
    → 逐元素绘制（空 resolvedContent 的元素跳过）
    → 输出海报图片
```

## 六、文件改动清单

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `strapi/plugins/zhao-common/server/src/content-types/site-config/schema.json` | 新增字段 | `posterDefaultUserName`、`posterDefaultUserAvatar`、`posterDefaultRecommendReason` |
| `strapi/plugins/zhao-common/server/src/services/config.ts` | 修改 | `getPublicConfig` 返回 3 个新字段 |
| `strapi/plugins/zhao-studio/server/src/services/poster.ts` | 修改 | `resolveTemplate` 优先级翻转 + 移除 requiredVariables 校验 |
| `strapi-backend/src/pages/tenant/detail.vue` | 新增分区 | 「海报兜底配置」表单分区（含详细说明文字） |
| `strapi-backend/src/pages/studio/poster-template/edit.vue` | 多项增强 | 背景图片/图片元素 MediaPicker + 元素列表徽章 + variableName 下拉 + 来源提示表 + isVariable 说明文字 |
| `strapi-course/services/auth-config.ts` | 修改 | AuthConfig 接口新增 3 字段 + `fetchAuthConfig` 解析新字段 |
| `strapi-course/utils/poster-templates.ts` | 修改 | `resolveTemplateLocal` 优先级翻转 |
| `strapi-course/components/share-poster/share-poster.vue` | 修改 | `fetchRenderData` 增加内置模板兜底内容补全 |
| `strapi-course/pages/profile/profile.vue` | 修改 | variables 传入 site-config 兜底值，移除硬编码默认值 |
| `strapi-course/pages/course-detail/course-detail.vue` | 修改 | variables 传入 site-config 兜底值 |
| `strapi-course/pages/exchange/detail.vue` | 修改 | variables 传入 site-config 兜底值，移除硬编码默认值 |

## 七、边界情况

1. **后端 API 可用但元素 content/defaultValue 为空**：靠内置模板按 elementKey 兜底 → 仍为空则跳过
2. **后端 API 不可用**：完全使用前端内置模板（`resolveTemplateLocal`），优先级逻辑一致
3. **用户新增了内置模板中没有的元素**：该元素无内置兜底，content/defaultValue 为空时直接跳过
4. **用户删除了内置模板中有的元素**：该元素不存在于后端返回中，不会凭空添加
5. **media 字段未配置**：`resolveMediaUrl(undefined)` 返回空字符串，元素跳过
6. **用户未登录**：`getUser()` 返回 null，`user?.nickname` 为 undefined，降级到 `siteConfig.posterDefaultUserName`

## 八、命名一致性

**Poster 模板变量名**（snake_case，在 `variableName` 字段中使用，前后端一致）：
- `title`、`values`、`main_image`、`logo`（brand_share）
- `user_name`、`user_avatar`、`course_image`、`recommend_reason`（course_share）
- `user_name`、`user_avatar`、`product_image`、`product_name`、`product_price`、`recommend_reason`（product_share）

**Site-config 字段名**（camelCase，与现有 `siteName`、`shareImage` 等保持一致）：
- `posterDefaultUserName`、`posterDefaultUserAvatar`、`posterDefaultRecommendReason`

**AuthConfig 字段名**（与 site-config 一致）：
- `posterDefaultUserName`、`posterDefaultUserAvatar`、`posterDefaultRecommendReason`

**Tenant 表单字段名**（与 site-config 一致，媒体字段附加 `Id`/`Url` 后缀）：
- `posterDefaultUserName`
- `posterDefaultUserAvatarId` / `posterDefaultUserAvatarUrl`
- `posterDefaultRecommendReason`

## 九、测试计划

### 9.1 后端单元测试

| 测试项 | 验证内容 | 预期结果 |
|---|---|---|
| 优先级翻转 - defaultValue 非空 | `defaultValue='自定义标题'`, `variables.title='站点名'` | `resolvedContent='自定义标题'` |
| 优先级翻转 - defaultValue 为空 | `defaultValue=''`, `variables.title='站点名'` | `resolvedContent='站点名'` |
| 优先级翻转 - 都为空 | `defaultValue=''`, `variables.title=''` | `resolvedContent=''`（渲染时跳过） |
| requiredVariables 移除 | 不传 `user_name` 但模板有 defaultValue | 不抛 POSTER_002 错误，使用 defaultValue |
| 新增 site-config 字段 | 查询 site-config 包含 3 个新字段 | 字段存在且类型正确 |
| getPublicConfig 返回新字段 | 调用 `/public/config` | `data.site` 包含 3 个新字段 |

### 9.2 前端集成测试

| 测试项 | 页面 | 验证内容 |
|---|---|---|
| brand_share 正常渲染 | profile | 站点名/描述/分享图/Logo 正确显示 |
| brand_share 内置兜底 | profile（后端模板 defaultValue 为空） | 内置模板 defaultValue 生效 |
| course_share 用户已登录 | course-detail | 真实昵称/头像显示 |
| course_share 用户未登录 | course-detail（未登录） | site-config 兜底用户名/头像显示 |
| course_share 兜底全链路 | course-detail（未登录 + site-config 未配置） | 内置模板 defaultValue 生效 |
| product_share 正常渲染 | exchange/detail | 商品名/价格/图片正确显示 |
| product_share 移除硬编码 | exchange/detail | 不再出现 `'好友'`/`'精品商品'`/`'0 积分'` |
| 后端不可用降级 | 任意页面（关闭后端） | 使用 `resolveTemplateLocal` 本地渲染，优先级逻辑一致 |

### 9.3 编辑器 UI 测试

| 测试项 | 验证内容 |
|---|---|
| 背景图片上传 | MediaPicker 弹出 → 选择图片 → 缩略图预览 → 清除按钮 |
| 图片元素上传（固定） | URL 填入 `content` 字段 |
| 图片元素上传（变量） | URL 填入 `defaultValue` 字段 |
| 元素列表徽章 | 变量元素显示蓝色徽章，固定元素显示灰色徽章 |
| variableName 下拉 | 选项来自 `requiredVariables` + `optionalVariables` |
| 变量来源提示表 | 按模板 code 显示对应的变量来源表 |
| isVariable 说明文字 | 勾选/取消勾选时显示对应的说明文字 |

### 9.4 租户配置页测试

| 测试项 | 验证内容 |
|---|---|
| 海报兜底配置分区显示 | 在「分享设置」后出现「海报兜底配置」分区 |
| 用户名保存 | 输入文本 → 保存 → 重新加载页面，值保持 |
| 头像上传 | MediaPicker 选择图片 → 保存 → `posterDefaultUserAvatarId` 正确存储 |
| 推荐理由保存 | 输入文本 → 保存 → `getPublicConfig` 返回该值 |

## 十、实施顺序

按依赖关系分 4 个阶段，每阶段完成后可独立验证：

### 阶段 1：后端 Schema + API（无前端依赖）

1. `site-config/schema.json` — 新增 3 个字段
2. `config.ts` → `getPublicConfig` — 返回 3 个新字段
3. `poster.ts` → `resolveTemplate` — 优先级翻转 + 移除 requiredVariables 校验
4. 重启 Strapi，验证 `/public/config` 返回新字段

### 阶段 2：前端配置层（依赖阶段 1）

5. `auth-config.ts` — AuthConfig 接口 + `fetchAuthConfig` 解析新字段
6. `poster-templates.ts` → `resolveTemplateLocal` — 优先级翻转

### 阶段 3：前端渲染层（依赖阶段 2）

7. `share-poster.vue` → `fetchRenderData` — 增加内置模板兜底内容补全
8. `profile.vue` — variables 传入 site-config 兜底值
9. `course-detail.vue` — variables 传入 site-config 兜底值
10. `exchange/detail.vue` — variables 传入 site-config 兜底值，移除硬编码

### 阶段 4：后台管理 UI（与前端并行）

11. `tenant/detail.vue` — 新增「海报兜底配置」表单分区
12. `poster-template/edit.vue` — MediaPicker + 徽章 + 下拉 + 提示表 + 说明文字
