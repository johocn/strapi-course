# 海报模板编辑器增强与渲染优先级重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现海报模板编辑器图片上传能力、渲染优先级翻转（编辑器配置优先）、租户级海报兜底配置，以及三页面变量构建更新。

**Architecture:** 后端 Strapi schema 新增 3 个 site-config 字段，getPublicConfig 返回这些字段；poster.ts 的 resolveTemplate 翻转优先级（defaultValue 优先于页面变量）并移除 requiredVariables 运行时校验。前端 auth-config.ts 解析新字段，poster-templates.ts 同步翻转优先级，share-poster.vue 增加内置模板兜底补全。三个页面（profile/course-detail/exchange）的 posterConfig 变量构建改为传入 site-config 兜底值并移除硬编码。后台 tenant/detail.vue 新增海报兜底配置表单分区，poster-template/edit.vue 增强 MediaPicker 图片上传、元素类型徽章、变量名下拉和来源提示表。

**Tech Stack:** Strapi v5 (Content Types, Services), Vue 3 (Composition API, uni-app), TypeScript, Canvas API

**Spec:** `docs/superpowers/specs/2026-08-09-poster-template-editor-design.md`

---

## File Structure

| 文件 | 职责 | 改动类型 |
|------|------|----------|
| `strapi/plugins/zhao-common/server/src/content-types/site-config/schema.json` | site-config 数据模型，新增 3 个海报兜底字段 | 新增字段 |
| `strapi/plugins/zhao-common/server/src/services/config.ts` | 公开配置 API，返回新字段 | 修改 |
| `strapi/plugins/zhao-studio/server/src/services/poster.ts` | 后端模板解析，优先级翻转 + 移除校验 | 修改 |
| `strapi-course/services/auth-config.ts` | 前端配置接口，新增 3 个字段 | 修改 |
| `strapi-course/utils/poster-templates.ts` | 前端内置模板，本地解析优先级翻转 | 修改 |
| `strapi-course/components/share-poster/share-poster.vue` | 海报组件，增加内置模板兜底补全 | 修改 |
| `strapi-course/pages/profile/profile.vue` | 品牌分享页，变量构建更新 | 修改 |
| `strapi-course/pages/course-detail/course-detail.vue` | 课程详情页，变量构建更新 | 修改 |
| `strapi-course/pages/exchange/detail.vue` | 积分兑换页，变量构建更新 | 修改 |
| `strapi-backend/src/pages/tenant/detail.vue` | 租户配置页，新增海报兜底配置分区 | 修改 |
| `strapi-backend/src/pages/studio/poster-template/edit.vue` | 模板编辑器，MediaPicker + 徽章 + 下拉 + 提示表 | 修改 |

---

### Task 1: 后端 site-config schema 新增海报兜底字段

**Files:**
- Modify: `strapi/plugins/zhao-common/server/src/content-types/site-config/schema.json`

- [ ] **Step 1: 在 schema.json 的 `attributes` 对象末尾（`website_redirect_rules` 之后）新增 3 个字段**

`website_redirect_rules` 是 `attributes` 的最后一个属性（其闭合 `}` 后**无逗号**）。需要先在其 `}` 后添加逗号，再追加 3 个新字段：

```json
    "website_redirect_rules": {
      "type": "relation",
      "relation": "oneToMany",
      "target": "plugin::zhao-website.redirect-rule",
      "mappedBy": "site"
    },
    "posterDefaultUserName": {
      "type": "string",
      "maxLength": 50,
      "description": "海报默认用户名"
    },
    "posterDefaultUserAvatar": {
      "type": "media",
      "multiple": false,
      "required": false,
      "allowedTypes": ["images"]
    },
    "posterDefaultRecommendReason": {
      "type": "string",
      "maxLength": 200,
      "description": "海报默认推荐理由"
    }
```

- [ ] **Step 2: 重启 Strapi 使 schema 变更生效**

Run: `cd d:\zhao\strapi && npm run develop`
Expected: Strapi 启动无报错，日志中可见 content-type 重建

- [ ] **Step 3: 验证字段已创建**

打开 Strapi Admin (`http://localhost:1337/admin`)，进入 Content-Type Builder → 站点配置，确认新增 3 个字段：`posterDefaultUserName`（Text）、`posterDefaultUserAvatar`（Media）、`posterDefaultRecommendReason`（Text）。

- [ ] **Step 4: Commit**

```bash
cd d:\zhao\strapi
git add plugins/zhao-common/server/src/content-types/site-config/schema.json
git commit -m "feat(poster): add posterDefault fields to site-config schema"
```

---

### Task 2: 后端 getPublicConfig 返回新字段

**Files:**
- Modify: `strapi/plugins/zhao-common/server/src/services/config.ts`

- [ ] **Step 1: 在 `PUBLIC_FIELDS` 数组中追加 2 个字符串字段**

找到 `getPublicConfig` 方法中的 `PUBLIC_FIELDS` 数组（约第 298 行），追加新字段：

```typescript
      const PUBLIC_FIELDS = [
        "siteName", "siteDescription", "seoKeywords", "seoDescription",
        "tencentMapKey", "shareTitle", "shareDescription", "icpNumber",
        "customerServiceUrl", "domain",
        // 新增：海报兜底配置
        "posterDefaultUserName", "posterDefaultRecommendReason",
      ];
```

- [ ] **Step 2: 在媒体字段处理段追加 `posterDefaultUserAvatar`**

找到 `if (fullConfig?.shareImage)` 行（约第 314 行），在其后追加：

```typescript
      if (fullConfig?.logo) sitePublic.logo = fullConfig.logo;
      if (fullConfig?.favicon) sitePublic.favicon = fullConfig.favicon;
      if (fullConfig?.shareImage) sitePublic.shareImage = fullConfig.shareImage;
      // 新增：海报默认头像
      if (fullConfig?.posterDefaultUserAvatar) sitePublic.posterDefaultUserAvatar = fullConfig.posterDefaultUserAvatar;
      result.site = sitePublic;
```

- [ ] **Step 3: 在默认配置（siteId 为 null 时）的 site 对象中追加 3 个空值字段**

找到 `if (!fullConfig)` 块中的 `site: { ... }` 对象（约第 260 行），追加字段：

```typescript
          site: {
            siteName: "", siteDescription: "", logo: "", favicon: "",
            shareTitle: "", shareDescription: "", shareImage: "",
            sharePath: "/pages/index/index", domain: "",
            // 新增：海报兜底配置
            posterDefaultUserName: "", posterDefaultUserAvatar: "",
            posterDefaultRecommendReason: "",
          },
```

- [ ] **Step 4: 重启 Strapi 并验证 API 返回**

Run: `cd d:\zhao\strapi && npm run develop`

验证命令（新终端）：
```bash
curl -s http://localhost:1337/api/zhao-common/v1/public/config?domain=localhost | python -m json.tool | findstr posterDefault
```
Expected: 输出包含 `posterDefaultUserName`、`posterDefaultRecommendReason` 字段（值为空字符串）

- [ ] **Step 5: Commit**

```bash
cd d:\zhao\strapi
git add plugins/zhao-common/server/src/services/config.ts
git commit -m "feat(poster): return posterDefault fields in getPublicConfig"
```

---

### Task 3: 后端 resolveTemplate 优先级翻转 + 移除 requiredVariables 校验

**Files:**
- Modify: `strapi/plugins/zhao-studio/server/src/services/poster.ts`

- [ ] **Step 1: 移除 requiredVariables 运行时校验**

找到 `resolveTemplate` 方法中的校验逻辑（约第 26-34 行），删除以下代码块：

```typescript
    // 删除以下代码块：
    // Validate required variables
    const requiredVars: string[] = template.requiredVariables || ['title', 'description', 'image_url', 'qr_code'];
    const missing = requiredVars.filter(v => !variables[v] && v !== 'invite_code');
    if (missing.length > 0) {
      const err: any = new Error(`Missing required variables: ${missing.join(', ')}`);
      err.code = 'POSTER_002';
      err.details = { missing };
      throw err;
    }
```

- [ ] **Step 2: 翻转变量元素优先级**

找到变量内容解析行（约第 46 行），将优先级从「页面变量优先」翻转为「defaultValue 优先」：

```typescript
    // 翻转前：
    //   resolved.resolvedContent = variables[element.variableName] ?? (element.defaultValue || '');
    // 翻转后：
    //   resolved.resolvedContent = element.defaultValue || variables[element.variableName] || '';
```

即将：
```typescript
          resolved.resolvedContent = variables[element.variableName] ?? (element.defaultValue || '');
```
改为：
```typescript
          resolved.resolvedContent = element.defaultValue || variables[element.variableName] || '';
```

注意：`invite_code` 的特殊处理分支（约第 42-44 行）保持不变，它已经使用 `element.defaultValue || ''`。

- [ ] **Step 3: 重启 Strapi 并验证优先级翻转**

Run: `cd d:\zhao\strapi && npm run develop`

验证命令（新终端）— 测试 defaultValue 优先：
```bash
curl -s -X POST http://localhost:1337/api/zhao-studio/v1/posters/render -H "Content-Type: application/json" -d "{\"templateCode\":\"brand_share\",\"variables\":{\"title\":\"页面传入的标题\",\"values\":\"页面传入的描述\",\"main_image\":\"\",\"qr_code\":\"https://example.com\",\"logo\":\"\"}}" | python -m json.tool
```
Expected: `title` 元素的 `resolvedContent` 应为空字符串（因为后端 seed 数据中 defaultValue 为空），`values` 元素同理。如果编辑器中设置了 defaultValue，则应返回 defaultValue 的值。

- [ ] **Step 4: 验证不传必填变量不再报错**

```bash
curl -s -X POST http://localhost:1337/api/zhao-studio/v1/posters/render -H "Content-Type: application/json" -d "{\"templateCode\":\"course_share\",\"variables\":{}}" | python -m json.tool
```
Expected: 返回正常 JSON（不再抛 POSTER_002 错误），各元素 `resolvedContent` 为空字符串

- [ ] **Step 5: Commit**

```bash
cd d:\zhao\strapi
git add plugins/zhao-studio/server/src/services/poster.ts
git commit -m "feat(poster): flip resolveTemplate priority and remove requiredVariables validation"
```

---

### Task 4: 前端 AuthConfig 接口扩展

**Files:**
- Modify: `strapi-course/services/auth-config.ts`

- [ ] **Step 1: 在 AuthConfig 接口中新增 3 个字段**

找到 `AuthConfig` interface（约第 9-48 行），在 `theme?: ThemeConfig` 之前追加：

```typescript
  // 海报兜底配置（新增）
  posterDefaultUserName: string
  posterDefaultUserAvatar: string  // resolveMediaUrl 后的 URL
  posterDefaultRecommendReason: string

  // 主题配置
  theme?: ThemeConfig
```

- [ ] **Step 2: 在 DEFAULT_CONFIG 中追加 3 个默认值**

找到 `DEFAULT_CONFIG` 常量（约第 92-121 行），在 `allowCrossChannel: false,` 之后追加（注意：DEFAULT_CONFIG 中没有 `theme` 字段）：

```typescript
  // 海报兜底配置
  posterDefaultUserName: '',
  posterDefaultUserAvatar: '',
  posterDefaultRecommendReason: '',

  // 主题配置（已有，不修改）
```

- [ ] **Step 3: 在 fetchAuthConfig 中解析新字段**

找到 `fetchAuthConfig` 函数中的 config 构造（约第 134-171 行），在 `theme: data.theme,` 之前追加：

```typescript
      // 海报兜底配置
      posterDefaultUserName: data.site?.posterDefaultUserName ?? DEFAULT_CONFIG.posterDefaultUserName,
      posterDefaultUserAvatar: resolveMediaUrl(data.site?.posterDefaultUserAvatar),
      posterDefaultRecommendReason: data.site?.posterDefaultRecommendReason ?? DEFAULT_CONFIG.posterDefaultRecommendReason,

      // 主题配置
      theme: data.theme,
```

- [ ] **Step 4: 验证前端编译无报错**

Run: `cd d:\zhao\strapi-course && npx vue-tsc --noEmit 2>&1 | findstr auth-config`
Expected: 无输出（无类型错误）

- [ ] **Step 5: Commit**

```bash
cd d:\zhao\strapi-course
git add services/auth-config.ts
git commit -m "feat(poster): add posterDefault fields to AuthConfig"
```

---

### Task 5: 前端 resolveTemplateLocal 优先级翻转

**Files:**
- Modify: `strapi-course/utils/poster-templates.ts`

- [ ] **Step 1: 翻转 resolveTemplateLocal 中的变量元素优先级**

找到 `resolveTemplateLocal` 函数中的变量解析行（约第 330 行）：

```typescript
        resolved.resolvedContent = variables[element.variableName] ?? (element.defaultValue || '')
```

改为：

```typescript
        resolved.resolvedContent = element.defaultValue || variables[element.variableName] || ''
```

注意：`invite_code` 的特殊处理分支（约第 327-329 行）保持不变。

- [ ] **Step 2: 验证前端编译无报错**

Run: `cd d:\zhao\strapi-course && npx vue-tsc --noEmit 2>&1 | findstr poster-templates`
Expected: 无输出（无类型错误）

- [ ] **Step 3: Commit**

```bash
cd d:\zhao\strapi-course
git add utils/poster-templates.ts
git commit -m "feat(poster): flip resolveTemplateLocal priority to match backend"
```

---

### Task 6: 前端 share-poster.vue 内置模板兜底补全

**Files:**
- Modify: `strapi-course/components/share-poster/share-poster.vue`

- [ ] **Step 1: 新增 BUILTIN_TEMPLATES 导入**

找到现有导入行（约第 43 行）：

```typescript
import { resolveTemplateLocal } from '@/utils/poster-templates'
```

改为：

```typescript
import { resolveTemplateLocal, BUILTIN_TEMPLATES } from '@/utils/poster-templates'
```

- [ ] **Step 2: 在 fetchRenderData 中增加内置模板兜底补全**

找到 `fetchRenderData` 函数（约第 138-158 行），在后端 API 返回成功后、return 之前，插入内置模板兜底逻辑：

```typescript
async function fetchRenderData(templateCode: string, variables: Record<string, any>) {
  // 1. 尝试后端 API
  try {
    const apiResult = await renderPoster(templateCode, variables)
    if (apiResult && apiResult.template && apiResult.elements) {
      console.log('[poster] 使用后端 API 模板:', templateCode)

      // 内置模板兜底：对 resolvedContent 为空的元素补全内容
      const builtin = BUILTIN_TEMPLATES[templateCode]
      if (builtin) {
        apiResult.elements.forEach((el: any) => {
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

      return apiResult
    }
  } catch (e) {
    console.warn('[poster] 后端 API 不可用，使用本地兜底:', e)
  }

  // 2. 本地兜底
  const localResult = resolveTemplateLocal(templateCode, variables)
  if (localResult) {
    console.log('[poster] 使用本地内置模板:', templateCode)
    return localResult
  }

  throw new Error(`无法获取海报模板: ${templateCode}`)
}
```

- [ ] **Step 3: 验证前端编译无报错**

Run: `cd d:\zhao\strapi-course && npx vue-tsc --noEmit 2>&1 | findstr share-poster`
Expected: 无输出（无类型错误）

- [ ] **Step 4: Commit**

```bash
cd d:\zhao\strapi-course
git add components/share-poster/share-poster.vue
git commit -m "feat(poster): add builtin template fallback in fetchRenderData"
```

---

### Task 7: 前端 profile.vue 变量构建更新

**Files:**
- Modify: `strapi-course/pages/profile/profile.vue`

- [ ] **Step 1: 移除 posterConfig 中的硬编码默认值**

找到 `posterConfig` 计算属性（约第 267-276 行），将硬编码默认值改为空字符串：

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

即把 `'圣麟教育'` 改为 `''`，把 `'让学习更有价值'` 改为 `''`。

- [ ] **Step 2: 验证前端编译无报错**

Run: `cd d:\zhao\strapi-course && npx vue-tsc --noEmit 2>&1 | findstr profile`
Expected: 无输出（无类型错误）

- [ ] **Step 3: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/profile/profile.vue
git commit -m "feat(poster): remove hardcoded defaults from profile posterConfig"
```

---

### Task 8: 前端 course-detail.vue 变量构建更新

**Files:**
- Modify: `strapi-course/pages/course-detail/course-detail.vue`

- [ ] **Step 1: 补充 resolveMediaUrl 导入**

找到现有 env 导入行（约第 96 行）：

```typescript
import { getImageUrl } from '../../utils/env'
```

改为：

```typescript
import { getImageUrl, resolveMediaUrl } from '../../utils/env'
```

- [ ] **Step 2: 更新 posterConfig 变量构建**

找到 `posterConfig` 计算属性（约第 117-129 行），替换为：

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

变更点：
- `user_name`：`'好友推荐'` → `siteConfig?.posterDefaultUserName || ''`
- `user_avatar`：空字符串兜底 → `resolveMediaUrl(siteConfig?.posterDefaultUserAvatar) || ''`
- `recommend_reason`：`'这门课程很棒，推荐给你'` → `siteConfig?.posterDefaultRecommendReason || ''`

- [ ] **Step 3: 验证前端编译无报错**

Run: `cd d:\zhao\strapi-course && npx vue-tsc --noEmit 2>&1 | findstr course-detail`
Expected: 无输出（无类型错误）

- [ ] **Step 4: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/course-detail/course-detail.vue
git commit -m "feat(poster): use site-config fallback in course-detail posterConfig"
```

---

### Task 9: 前端 exchange/detail.vue 变量构建更新

**Files:**
- Modify: `strapi-course/pages/exchange/detail.vue`

- [ ] **Step 1: 确认 resolveMediaUrl 导入**

检查文件顶部导入区域，如果尚未导入 `resolveMediaUrl`，添加导入：

```typescript
import { getImageUrl, resolveMediaUrl } from '../../utils/env'
```

现有导入行为 `import { getImageUrl, BASE_URL } from '../../utils/env'`（BASE_URL 在文件 230/234 行使用，不可丢弃）。修改为：

```typescript
import { getImageUrl, BASE_URL, resolveMediaUrl } from '../../utils/env'
```

- [ ] **Step 2: 确认 siteConfig 和 getUser 导入**

确认以下导入存在（如不存在则添加）：

```typescript
import { getStoredAuthConfig } from '../../services/auth-config'
import { getUser } from '../../utils/storage'
```

并在 setup 中获取 siteConfig：

```typescript
const siteConfig = getStoredAuthConfig()
```

- [ ] **Step 3: 更新 posterConfig 变量构建**

找到 `posterConfig` 计算属性（约第 173-184 行），替换为：

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
      recommend_reason: product.value.subtitle || product.value.description || siteConfig?.posterDefaultRecommendReason || '',
    },
  }
})
```

变更点：
- `user_name`：`'好友'` → `siteConfig?.posterDefaultUserName || ''`
- `user_avatar`：空字符串兜底 → `resolveMediaUrl(siteConfig?.posterDefaultUserAvatar) || ''`
- `product_name`：`'精品商品'` → `''`
- `product_price`：`'0 积分'` → `''`
- `recommend_reason`：保留 `product.value.description`，兜底改为 `siteConfig?.posterDefaultRecommendReason || ''`

- [ ] **Step 4: 验证前端编译无报错**

Run: `cd d:\zhao\strapi-course && npx vue-tsc --noEmit 2>&1 | findstr exchange`
Expected: 无输出（无类型错误）

- [ ] **Step 5: Commit**

```bash
cd d:\zhao\strapi-course
git add pages/exchange/detail.vue
git commit -m "feat(poster): use site-config fallback and remove hardcoded defaults in exchange posterConfig"
```

---

### Task 10: 后台 tenant/detail.vue 新增海报兜底配置分区

**Files:**
- Modify: `strapi-backend/src/pages/tenant/detail.vue`

- [ ] **Step 1: 在 SCHEMA_FIELDS 集合中追加 3 个新字段名**

找到 `SCHEMA_FIELDS` 定义（约第 487-497 行），在 `'channels'` 之后追加：

```javascript
const SCHEMA_FIELDS = new Set([
  'siteName', 'siteDescription', 'logo', 'favicon', 'icpNumber',
  'seoKeywords', 'seoDescription', 'tencentMapKey', 'shareTitle',
  'shareDescription', 'shareImage', 'customerServiceUrl',
  'featureFlags', 'domain', 'template', 'themeConfig', 'channelUsage',
  'channels', 'extraConfig',
  // 新增：海报兜底配置
  'posterDefaultUserName', 'posterDefaultUserAvatar', 'posterDefaultRecommendReason',
  'documentId', 'id', 'createdAt', 'updatedAt', 'publishedAt',
  'createdBy', 'updatedBy', 'locale', '_meta',
])
```

- [ ] **Step 2: 在 formData 中追加 3 个字段（媒体字段用双字段模式）**

找到 `formData` 定义（约第 604-637 行），在 `shareImageId` / `shareImageUrl` 之后追加：

```javascript
  // 海报兜底配置
  posterDefaultUserName: '',
  posterDefaultUserAvatarId: null,
  posterDefaultUserAvatarUrl: '',
  posterDefaultRecommendReason: '',
```

- [ ] **Step 3: 在加载回填逻辑中追加新字段**

找到媒体字段加载回填段（约第 736-747 行，`if (data.shareImage)` 之后），追加：

```javascript
  // 海报兜底配置回填
  formData.posterDefaultUserName = data.posterDefaultUserName || ''
  formData.posterDefaultRecommendReason = data.posterDefaultRecommendReason || ''
  if (data.posterDefaultUserAvatar) {
    formData.posterDefaultUserAvatarId = data.posterDefaultUserAvatar.id
    formData.posterDefaultUserAvatarUrl = data.posterDefaultUserAvatar ? getMediaUrl(data.posterDefaultUserAvatar) : ''
  }
```

- [ ] **Step 4: 在 onMediaSelected 中追加 posterAvatar 分支**

找到 `onMediaSelected` 函数（约第 990-1001 行），在 `shareImage` 分支之后追加：

```javascript
function onMediaSelected(file) {
  const t = mediaPickerTarget.value
  if (t === 'logo') { formData.logoId = file.id; formData.logoUrl = file.url }
  else if (t === 'favicon') { formData.faviconId = file.id; formData.faviconUrl = file.url }
  else if (t === 'shareImage') { formData.shareImageId = file.id; formData.shareImageUrl = file.url }
  else if (t === 'posterDefaultUserAvatar') { formData.posterDefaultUserAvatarId = file.id; formData.posterDefaultUserAvatarUrl = file.url }
  showMediaPicker.value = false
}
```

- [ ] **Step 5: 在 removeMedia 中追加 posterDefaultUserAvatar 分支**

找到 `removeMedia` 函数（约第 990-1001 行区域），追加：

```javascript
function removeMedia(target) {
  if (target === 'logo') { formData.logoId = null; formData.logoUrl = '' }
  else if (target === 'favicon') { formData.faviconId = null; formData.faviconUrl = '' }
  else if (target === 'shareImage') { formData.shareImageId = null; formData.shareImageUrl = '' }
  else if (target === 'posterDefaultUserAvatar') { formData.posterDefaultUserAvatarId = null; formData.posterDefaultUserAvatarUrl = '' }
}
```

- [ ] **Step 6: 在 saveTenant 的提交 data 中追加新字段**

找到 `saveTenant` 函数中构造 `data` 对象的部分（约第 1009-1103 行），在 `shareImage: formData.shareImageId ?? undefined,` 之后追加：

```javascript
    // 海报兜底配置
    posterDefaultUserName: formData.posterDefaultUserName,
    posterDefaultUserAvatar: formData.posterDefaultUserAvatarId ?? undefined,
    posterDefaultRecommendReason: formData.posterDefaultRecommendReason,
```

- [ ] **Step 7: 在模板中新增「海报兜底配置」表单分区**

在模板中找到「分享设置」分区（约第 71-93 行），在其 `</view>` 闭合之后、「功能开关」分区之前，追加新分区。注意复用已有的 `media-select`/`media-preview`/`media-placeholder`/`media-remove` CSS 类（与 logo/favicon/shareImage 一致）：

```html
      <!-- 海报兜底配置 -->
      <view class="form-section">
        <text class="section-title">海报兜底配置</text>

        <view class="form-item">
          <text class="form-label">海报默认用户名</text>
          <input type="text" v-model="formData.posterDefaultUserName" placeholder="当用户未登录或未设置昵称时显示" class="form-input" />
        </view>

        <view class="form-item">
          <text class="form-label">海报默认用户头像</text>
          <view class="media-select" @click="openMediaPicker('posterDefaultUserAvatar')">
            <image v-if="formData.posterDefaultUserAvatarUrl" :src="formData.posterDefaultUserAvatarUrl" mode="aspectFill" class="media-preview" />
            <view v-else class="media-placeholder"><text>+ 选择头像</text></view>
            <text v-if="formData.posterDefaultUserAvatarUrl" class="media-remove" @click.stop="removeMedia('posterDefaultUserAvatar')">✕</text>
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">海报默认推荐理由</text>
          <input type="text" v-model="formData.posterDefaultRecommendReason" placeholder="当课程/商品没有描述时显示" class="form-input" />
        </view>
      </view>
```

- [ ] **Step 8: 更新 MediaPicker 组件的 folder 逻辑**

找到 MediaPicker 组件的 `:folder` 属性（约第 446-452 行），扩展 folder 逻辑以支持 posterDefaultUserAvatar：

```html
      <MediaPicker
        :visible="showMediaPicker"
        :folder="mediaPickerTarget === 'favicon' ? '/site/favicons' : mediaPickerTarget === 'posterDefaultUserAvatar' ? '/site/poster-avatars' : '/site/images'"
        accept="image/*"
        @select="onMediaSelected"
        @update:visible="showMediaPicker = $event"
      />
```

- [ ] **Step 9: 验证后台管理页编译无报错**

Run: `cd d:\zhao\strapi-backend && npm run dev`
Expected: 编译无报错，租户配置页正常加载

- [ ] **Step 10: 手动验证**

1. 打开 `http://localhost:5174/#/pages/tenant/detail?documentId=wb8fpbnye8j81d0vrgycmdej&mode=edit`
2. 确认「分享设置」分区后出现「海报兜底配置」分区
3. 输入用户名和推荐理由，上传头像图片
4. 点击保存，刷新页面，确认数据保持

- [ ] **Step 11: Commit**

```bash
cd d:\zhao\strapi-backend
git add src/pages/tenant/detail.vue
git commit -m "feat(poster): add poster fallback config section to tenant detail page"
```

---

### Task 11: 后台 poster-template/edit.vue 编辑器增强

**Files:**
- Modify: `strapi-backend/src/pages/studio/poster-template/edit.vue`

- [ ] **Step 1: 导入 MediaPicker 组件**

在 `<script setup>` 区域，添加 MediaPicker 组件导入。strapi-backend 不支持 `@/` 别名，使用相对路径（poster-template/edit.vue 位于 `src/pages/studio/poster-template/`，需向上 3 级）：

```javascript
import MediaPicker from '../../../components/MediaPicker.vue'
```

- [ ] **Step 2: 添加 MediaPicker 响应式状态**

在 `form` ref 定义之后（约第 405 行之后），添加：

```javascript
// MediaPicker 状态
const showBgImagePicker = ref(false)
const showElementImagePicker = ref(false)
const elementImageTarget = ref('') // 'content' 或 'defaultValue'

// 元素类型徽章颜色映射
function getElementTypeBadge(el) {
  if (el.isVariable) {
    return { text: `变量: ${el.variableName || '未设置'}`, class: 'badge-variable' }
  }
  return { text: '固定', class: 'badge-fixed' }
}

// 变量名下拉选项
const variableOptions = computed(() => {
  const required = form.value.requiredVariables.split('\n').map(v => v.trim()).filter(Boolean)
  const optional = form.value.optionalVariables.split('\n').map(v => v.trim()).filter(Boolean)
  return [...required, ...optional]
})

// 变量来源提示表数据
const VARIABLE_SOURCE_TABLE = [
  { template: 'brand_share', varName: 'title', type: 'text', source: '站点名称 (siteConfig.siteName)', required: true },
  { template: 'brand_share', varName: 'values', type: 'text', source: '站点描述 (siteConfig.siteDescription)', required: true },
  { template: 'brand_share', varName: 'main_image', type: 'image', source: '站点分享图 (siteConfig.shareImage)', required: true },
  { template: 'brand_share', varName: 'logo', type: 'image', source: '站点 Logo (siteConfig.logo)', required: false },
  { template: 'course_share', varName: 'user_name', type: 'text', source: '用户昵称 → 海报默认用户名', required: true },
  { template: 'course_share', varName: 'user_avatar', type: 'image', source: '用户头像 → 海报默认用户头像', required: false },
  { template: 'course_share', varName: 'course_image', type: 'image', source: '课程封面 (course.coverUrl)', required: true },
  { template: 'course_share', varName: 'recommend_reason', type: 'text', source: '课程描述 → 海报默认推荐理由', required: false },
  { template: 'product_share', varName: 'user_name', type: 'text', source: '同 course_share', required: true },
  { template: 'product_share', varName: 'user_avatar', type: 'image', source: '同 course_share', required: false },
  { template: 'product_share', varName: 'product_image', type: 'image', source: '商品图片', required: true },
  { template: 'product_share', varName: 'product_name', type: 'text', source: '商品名称', required: true },
  { template: 'product_share', varName: 'product_price', type: 'text', source: '商品价格', required: true },
  { template: 'product_share', varName: 'recommend_reason', type: 'text', source: '商品描述 → 海报默认推荐理由', required: false },
]

const currentVariableTable = computed(() => {
  return VARIABLE_SOURCE_TABLE.filter(item => item.template === form.value.code)
})

// MediaPicker 回调
function onBgImageSelected(file) {
  form.value.backgroundImage = file.url
  showBgImagePicker.value = false
}

function clearBgImage() {
  form.value.backgroundImage = ''
}

function openElementImagePicker(target) {
  elementImageTarget.value = target
  showElementImagePicker.value = true
}

function onElementImageSelected(file) {
  if (elementImageTarget.value === 'content') {
    editingElement.value.content = file.url
  } else if (elementImageTarget.value === 'defaultValue') {
    editingElement.value.defaultValue = file.url
  }
  showElementImagePicker.value = false
}

function clearElementImage() {
  if (editingElement.value.isVariable) {
    editingElement.value.defaultValue = ''
  } else {
    editingElement.value.content = ''
  }
}
```

- [ ] **Step 3: 替换背景图片 URL 输入框为 MediaPicker**

找到背景图片 URL 输入框（约第 65-68 行），替换为。使用 `media-select`/`media-preview`/`media-placeholder`/`media-remove` 类名（与 tenant/detail.vue 一致，CSS 在 Step 10 中统一添加）：

```html
          <view class="form-item">
            <text class="form-label">背景图片</text>
            <view class="media-select" @click="showBgImagePicker = true">
              <image v-if="form.backgroundImage" :src="form.backgroundImage" mode="aspectFit" class="media-preview" />
              <view v-else class="media-placeholder"><text>+ 选择图片</text></view>
              <text v-if="form.backgroundImage" class="media-remove" @click.stop="clearBgImage">✕</text>
            </view>
          </view>
```

- [ ] **Step 4: 在元素列表行中添加类型徽章**

找到元素列表渲染区域（约第 100-117 行），在每个元素行的 `element-info` 中添加类型徽章：

```html
        <view class="element-list" v-if="elements.length > 0">
          <view class="element-row" v-for="(el, idx) in elements" :key="idx">
            <view class="element-info">
              <text class="element-type">{{ getElementTypeLabel(el.elementType) }}</text>
              <text class="element-key">{{ el.elementKey }}</text>
              <text class="element-name">{{ el.elementName || '-' }}</text>
              <text class="element-pos">{{ el.x }},{{ el.y }}</text>
              <!-- 类型徽章 -->
              <text :class="['element-badge', getElementTypeBadge(el).class]">{{ getElementTypeBadge(el).text }}</text>
            </view>
            <view class="element-actions">
              <view class="action-btn edit" @click="startEditElement(idx)">编辑</view>
              <view class="action-btn delete" @click="removeElement(idx)">删除</view>
            </view>
          </view>
        </view>
```

- [ ] **Step 5: 替换 variableName 自由文本输入为下拉选择**

找到元素编辑表单中现有的 variableName 输入框（约第 157-160 行，带 `v-if="editingElement.isVariable"` 条件的 `<input>`），替换为 picker 下拉选择：

```html
            <!-- 变量名下拉选择（替换原有 input） -->
            <view class="form-item" v-if="editingElement.isVariable">
              <text class="form-label">变量名</text>
              <picker mode="selector" :range="variableOptions" :value="variableOptions.indexOf(editingElement.variableName)" @change="editingElement.variableName = variableOptions[$event.detail.value]">
                <view class="form-picker">
                  <text>{{ editingElement.variableName || '请选择变量' }}</text>
                  <text class="arrow">▼</text>
                </view>
              </picker>
            </view>
```

- [ ] **Step 6: 添加图片元素上传控件**

找到图片元素专属区域（约第 277-286 行），在 `imageFit` picker 之后添加图片上传控件（使用 `media-select` 模式）：

```html
            <!-- 图片元素专属 -->
            <view class="form-item" v-if="editingElement.elementType === 'image'">
              <text class="form-label">图片适应</text>
              <picker mode="selector" :range="elementPickerConfigs.imageFit.labels" :value="elPickerIndex('imageFit')" @change="handleElPickerChange('imageFit', $event)">
                <view class="form-picker">
                  <text>{{ elementPickerConfigs.imageFit.labels[elPickerIndex('imageFit')] }}</text>
                  <text class="arrow">▼</text>
                </view>
              </picker>
            </view>

            <!-- 图片上传 -->
            <view class="form-item" v-if="editingElement.elementType === 'image'">
              <text class="form-label">
                {{ editingElement.isVariable ? '默认图片（优先值）' : '图片 URL' }}
              </text>
              <view class="media-select" @click="openElementImagePicker(editingElement.isVariable ? 'defaultValue' : 'content')">
                <image v-if="editingElement.isVariable ? editingElement.defaultValue : editingElement.content" :src="editingElement.isVariable ? editingElement.defaultValue : editingElement.content" mode="aspectFit" class="media-preview" />
                <view v-else class="media-placeholder"><text>+ 选择图片</text></view>
                <text v-if="editingElement.isVariable ? editingElement.defaultValue : editingElement.content" class="media-remove" @click.stop="clearElementImage">✕</text>
              </view>
              <text class="form-hint" v-if="editingElement.isVariable">
                此值非空时优先生效，前端页面传入的值作为兜底
              </text>
            </view>
```

- [ ] **Step 7: 添加 isVariable 说明文字**

找到 isVariable 开关的表单项，在其下方添加说明文字：

```html
            <view class="form-item">
              <text class="form-label">变量元素</text>
              <switch :checked="editingElement.isVariable" @change="editingElement.isVariable = $event.detail.value" />
            </view>
            <view class="form-hint-block" v-if="editingElement.isVariable">
              <text class="form-hint-title">☑ 变量元素</text>
              <text class="form-hint-text">此元素的值由前端页面动态传入。在编辑器中设置的值作为优先值（非空时优先生效），前端页面传入的值作为兜底。适用于需要动态内容的元素（如用户名、课程封面）。</text>
            </view>
            <view class="form-hint-block" v-else>
              <text class="form-hint-title">☐ 固定元素</text>
              <text class="form-hint-text">此元素始终使用在此设置的值，不受前端页面影响。适用于静态内容（如底部提示文字、装饰性色块）。</text>
            </view>
```

- [ ] **Step 8: 添加变量来源提示表**

在元素编辑区域末尾（元素列表之前或之后），添加来源提示表：

```html
        <!-- 变量来源提示表 -->
        <view class="variable-source-table" v-if="currentVariableTable.length > 0">
          <text class="table-title">变量来源参考表（{{ form.code }}）</text>
          <view class="table-header">
            <text class="th">变量名</text>
            <text class="th">类型</text>
            <text class="th">前端来源</text>
            <text class="th">必填</text>
          </view>
          <view class="table-row" v-for="item in currentVariableTable" :key="item.varName">
            <text class="td">{{ item.varName }}</text>
            <text class="td">{{ item.type }}</text>
            <text class="td">{{ item.source }}</text>
            <text class="td">{{ item.required ? '是' : '否' }}</text>
          </view>
        </view>
```

- [ ] **Step 9: 添加 MediaPicker 组件到模板**

在模板末尾（其他 MediaPicker 附近或 template 根元素闭合前），添加两个 MediaPicker：

```html
    <!-- 背景图片选择器 -->
    <MediaPicker
      :visible="showBgImagePicker"
      :folder="'/studio/poster-bg'"
      accept="image/*"
      @select="onBgImageSelected"
      @update:visible="showBgImagePicker = $event"
    />

    <!-- 元素图片选择器 -->
    <MediaPicker
      :visible="showElementImagePicker"
      :folder="'/studio/poster-elements'"
      accept="image/*"
      @select="onElementImageSelected"
      @update:visible="showElementImagePicker = $event"
    />
```

- [ ] **Step 10: 添加新增 CSS 样式**

在 `<style>` 区域末尾追加：

```css
/* 元素类型徽章 */
.element-badge {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  margin-left: 8rpx;
}
.badge-variable {
  background: #e8f0fe;
  color: #1967d2;
}
.badge-fixed {
  background: #f0f0f0;
  color: #666;
}

/* 媒体选择器（与 tenant/detail.vue 一致） */
.media-select {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  border: 2rpx dashed #ccc;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.media-preview {
  width: 100%;
  height: 100%;
  border-radius: 8rpx;
}
.media-placeholder {
  font-size: 22rpx;
  color: #999;
}
.media-remove {
  position: absolute;
  top: 0;
  right: 0;
  width: 36rpx;
  height: 36rpx;
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0 0 0 8rpx;
  z-index: 1;
}

/* 提示文字 */
.form-hint {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}
.form-hint-block {
  padding: 12rpx 16rpx;
  background: #f8f9fa;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}
.form-hint-title {
  display: block;
  font-size: 24rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 6rpx;
}
.form-hint-text {
  display: block;
  font-size: 22rpx;
  color: #666;
  line-height: 1.5;
}

/* 变量来源提示表 */
.variable-source-table {
  margin: 20rpx 0;
  border: 1rpx solid #e0e0e0;
  border-radius: 8rpx;
  overflow: hidden;
}
.table-title {
  display: block;
  padding: 16rpx;
  background: #f5f5f5;
  font-size: 26rpx;
  font-weight: bold;
  color: #333;
}
.table-header {
  display: flex;
  background: #fafafa;
  border-bottom: 1rpx solid #e0e0e0;
}
.table-row {
  display: flex;
  border-bottom: 1rpx solid #f0f0f0;
}
.table-header .th,
.table-row .td {
  flex: 1;
  padding: 12rpx 16rpx;
  font-size: 22rpx;
  color: #555;
}
.table-header .th {
  font-weight: bold;
  color: #333;
}
```

- [ ] **Step 11: 验证后台管理页编译无报错**

Run: `cd d:\zhao\strapi-backend && npm run dev`
Expected: 编译无报错，海报模板编辑页正常加载

- [ ] **Step 12: 手动验证**

1. 打开海报模板编辑页 `http://localhost:5174/#/pages/studio/poster-template/edit`
2. 验证背景图片区域显示「+ 选择图片」占位框，点击可打开 MediaPicker
3. 验证元素列表每行显示类型徽章（变量元素蓝色、固定元素灰色）
4. 点击编辑元素，验证 isVariable 开关下方显示说明文字
5. 开启 isVariable 后，变量名变为下拉选择
6. 元素类型为 image 时，显示图片上传控件
7. 页面底部显示变量来源参考表

- [ ] **Step 13: Commit**

```bash
cd d:\zhao\strapi-backend
git add src/pages/studio/poster-template/edit.vue
git commit -m "feat(poster): enhance poster template editor with MediaPicker, badges, dropdown and source table"
```

---

## 集成验证清单

完成所有 Task 后，执行以下端到端验证：

- [ ] **V1: profile 页海报生成**（brand_share 模板）
  1. 确保后端 Strapi 运行中
  2. 打开 `http://localhost:5175/#/pages/profile/profile`
  3. 点击分享 → 生成海报
  4. 验证海报显示站点名称、描述、分享图、Logo
  5. 在编辑器中为 title 元素设置非空 defaultValue，重新生成海报，验证标题为编辑器值

- [ ] **V2: course-detail 页海报生成（已登录用户）**
  1. 登录后打开课程详情页
  2. 点击分享 → 生成海报
  3. 验证海报显示真实用户昵称、头像、课程封面

- [ ] **V3: course-detail 页海报生成（未登录用户）**
  1. 退出登录，打开课程详情页
  2. 点击分享 → 生成海报
  3. 验证海报显示租户配置的默认用户名和默认头像

- [ ] **V4: exchange 页海报生成**
  1. 打开积分兑换商品详情页
  2. 点击分享 → 生成海报
  3. 验证海报显示商品名称、价格、图片，不再出现 `'好友'`/`'精品商品'`/`'0 积分'`

- [ ] **V5: 后端不可用降级**
  1. 停止后端 Strapi
  2. 打开任意页面生成海报
  3. 验证使用本地内置模板渲染，优先级逻辑一致
  4. 重启 Strapi

- [ ] **V6: 租户配置保存**
  1. 在租户配置页设置海报默认用户名、头像、推荐理由
  2. 保存后刷新页面，验证数据保持
  3. 调用 `/api/zhao-common/v1/public/config?domain=localhost`，验证返回新字段

- [ ] **V7: requiredVariables 不再阻断**
  1. 在编辑器中清空某变量元素的 defaultValue
  2. 前端不传该变量
  3. 验证海报正常生成，该元素被跳过（不报错）
