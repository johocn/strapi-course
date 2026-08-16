# 首页广告幻灯片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 strapi-course 首页头部和搜索栏之间插入广告轮播幻灯片，通过后端种子数据初始化 1 条含 2 张轮播图片的广告内容，验证全链路可用性。

**Architecture:** 复用已有 `ad-banner.vue` 组件（支持 slideshow 模式），在 `bootstrap.ts` 中新增广告种子函数创建 1 个 ad-zone + 1 条 ad-content（含 2 张图片），生成 2 张默认 banner 图片。前端在首页插入组件标签，并增强 slideshow 模式的标题显示。

**Tech Stack:** Strapi v5 Document API, Vue 3 + uni-app, TypeScript

**Spec:** `docs/superpowers/specs/2026-08-09-homepage-ad-slideshow-design.md`

---

## File Structure

| 文件 | 操作 | 责任 |
|------|------|------|
| `strapi/public/uploads/ads/banner-courses.jpg` | 新增 | 默认广告图片 1（课程主题） |
| `strapi/public/uploads/ads/banner-points.jpg` | 新增 | 默认广告图片 2（积分主题） |
| `strapi/plugins/zhao-studio/server/src/bootstrap.ts` | 修改 | 新增 `seedAdData` 函数 |
| `strapi-course/components/ad-banner/ad-banner.vue` | 修改 | slideshow 模式增加标题覆盖层 |
| `strapi-course/pages/index/index.vue` | 修改 | 插入 `<ad-banner>` 组件 |

---

## Task 1: 生成默认广告图片

**Files:**
- Create: `d:\zhao\strapi\public\uploads\ads\banner-courses` (扩展名由工具自动决定)
- Create: `d:\zhao\strapi\public\uploads\ads\banner-points` (扩展名由工具自动决定)

- [ ] **Step 1: 创建广告图片目录**

Run:
```powershell
New-Item -ItemType Directory -Path 'd:\zhao\strapi\public\uploads\ads' -Force
```
Expected: 目录创建成功

- [ ] **Step 2: 生成课程主题 banner 图片**

使用 GenerateImage 工具，保存到 `d:\zhao\strapi\public\uploads\ads\banner-courses`，尺寸 `landscape_16_9`。

Prompt: `[PURPOSE]: Mobile app homepage advertisement banner background. [DESCRIPTION]: A modern, clean banner background for an online course platform. Purple gradient background (from #667eea to #764ba2), with subtle decorative elements like floating books, graduation caps, and light bulbs. No text. Minimalist style, warm and inviting atmosphere, suitable for mobile banner display.`

- [ ] **Step 3: 生成积分主题 banner 图片**

使用 GenerateImage 工具，保存到 `d:\zhao\strapi\public\uploads\ads\banner-points`，尺寸 `landscape_16_9`。

Prompt: `[PURPOSE]: Mobile app homepage advertisement banner background. [DESCRIPTION]: A modern, energetic banner background for a learning rewards program. Golden and warm orange gradient background (from #FFD700 to #FF8C00), with subtle decorative elements like coins, trophies, stars, and upward growth arrows. No text. Minimalist style, motivational atmosphere, suitable for mobile banner display.`

- [ ] **Step 4: 确认图片文件及扩展名**

Run:
```powershell
Get-ChildItem 'd:\zhao\strapi\public\uploads\ads\' | Select-Object Name
```
Expected: 列出 2 个文件。记录实际扩展名（可能是 .jpg 或 .png），后续种子数据中使用实际路径。

---

## Task 2: 后端种子数据

**Files:**
- Modify: `d:\zhao\strapi\plugins\zhao-studio\server\src\bootstrap.ts`

> **关键设计决策**：创建 1 条 ad-content（而非 2 条），其 `images` 数组包含 2 张图片。因为 `ad-banner.vue` 的 slideshow 模式是对单条 content 内部的 `images` 数组创建 swiper，多条 content 会产生多个独立 swiper。

- [ ] **Step 1: 在 bootstrap.ts 中添加 seedAdData 函数和调用**

使用 SearchReplace 工具修改 `d:\zhao\strapi\plugins\zhao-studio\server\src\bootstrap.ts`。

搜索：
```typescript
  } catch (e: any) {
    strapi.log.error(`[zhao-studio] Failed to seed default poster template: ${e.message}`);
    strapi.log.error(`[zhao-studio] Seed error stack: ${e.stack}`);
  }
};
```

替换为：
```typescript
  } catch (e: any) {
    strapi.log.error(`[zhao-studio] Failed to seed default poster template: ${e.message}`);
    strapi.log.error(`[zhao-studio] Seed error stack: ${e.stack}`);
  }

  // Seed default ad data (home-banner zone + 1 slideshow content with 2 images)
  try {
    const adResult = await seedAdData(strapi);
    strapi.log.info(`[zhao-studio] Ad seed result: ${JSON.stringify(adResult)}`);
  } catch (e: any) {
    strapi.log.error(`[zhao-studio] Failed to seed ad data: ${e.message}`);
    strapi.log.error(`[zhao-studio] Ad seed error stack: ${e.stack}`);
  }
};

/**
 * Seed default ad zone and contents for homepage banner
 * Idempotent: skips if zone with code 'course-home-banner' already exists
 */
async function seedAdData(strapi: any) {
  strapi.log.info('[zhao-studio] Starting ad data seed...');

  // 1. Find default site
  const sites = await strapi.documents('plugin::zhao-common.site-config').findMany({ limit: 1 });
  if (!sites || sites.length === 0) {
    strapi.log.warn('[zhao-studio] No site found, skipping ad seed');
    return { success: false, reason: 'no_site' };
  }
  const siteId = sites[0].documentId;
  strapi.log.info(`[zhao-studio] Ad seed using site documentId: ${siteId}`);

  // 2. Check if ad-zone already exists (idempotent)
  const existingZones = await strapi.documents('plugin::zhao-studio.ad-zone').findMany({
    filters: { code: 'course-home-banner' },
    limit: 1,
  });
  if (existingZones && existingZones.length > 0) {
    strapi.log.info('[zhao-studio] Ad zone "course-home-banner" already exists, skipping seed');
    return { success: true, reason: 'already_exists', zoneId: existingZones[0].documentId };
  }

  // 3. Create ad-zone
  const zone = await strapi.documents('plugin::zhao-studio.ad-zone').create({
    data: {
      name: '课程首页',
      code: 'course-home-banner',
      position: 'home-banner',
      displayMode: 'slideshow',
      isActive: true,
      suggestedWidth: 750,
      suggestedHeight: 300,
      site: siteId,
    },
  });
  strapi.log.info(`[zhao-studio] Ad zone created: course-home-banner (documentId: ${zone.documentId})`);

  // 4. Create ad-content with 2 slideshow images
  //    images 数组包含 2 张图片，ad-banner 组件会对该数组创建 swiper
  await strapi.documents('plugin::zhao-studio.ad-content').create({
    data: {
      name: '首页轮播广告',
      contentType: 'slideshow',
      title: '精选好课 限时免费',
      images: [
        '/uploads/ads/banner-courses.jpg',
        '/uploads/ads/banner-points.jpg',
      ],
      linkType: 'internal',
      linkUrl: '/pages/index/index',
      isActive: true,
      sortOrder: 0,
      priority: 10,
      slideshowAutoplay: true,
      slideshowInterval: 4000,
      slideshowLoop: true,
      slideshowShowDots: true,
      adZone: zone.documentId,
      site: siteId,
    },
  });
  strapi.log.info('[zhao-studio] Ad content created: 首页轮播广告 (2 images)');

  strapi.log.info('[zhao-studio] Ad data seed completed: 1 zone + 1 content (2 images)');
  return { success: true, zoneId: zone.documentId, contents: 1, images: 2 };
}
```

> **注意**：如果 Task 1 Step 4 确认图片扩展名不是 `.jpg`，需将 `images` 数组中的路径改为实际扩展名。

- [ ] **Step 2: 编译 zhao-studio 插件**

Run:
```powershell
cd 'd:\zhao\strapi\plugins\zhao-studio' ; npm run build
```
Expected: 编译成功，无错误

---

## Task 3: 增强 ad-banner 组件 slideshow 模式标题显示

**Files:**
- Modify: `d:\zhao\strapi-course\components\ad-banner\ad-banner.vue`

> **原因**：slideshow 模板当前不显示标题覆盖层。需要在每个 swiper-item 内添加标题，并确保 `.ad-slide-item` 有 `position: relative` 以支持绝对定位。

- [ ] **Step 1: 在 slideshow 模板的 swiper-item 内添加标题覆盖层**

使用 SearchReplace 工具，搜索：

```vue
            <view class="ad-slide-item" @click.stop="handleImageClick(content, slideIdx)">
              <image
                v-if="!hasImageError(index, slideIdx)"
                :src="resolveImageUrl(img)"
                mode="aspectFill"
                class="ad-slide-img"
                @error="onImageError(index, slideIdx)"
              />
              <view v-else class="ad-slide-placeholder">
                <text class="ad-slide-placeholder-text">图片加载失败</text>
              </view>
            </view>
```

替换为：

```vue
            <view class="ad-slide-item" @click.stop="handleImageClick(content, slideIdx)">
              <image
                v-if="!hasImageError(index, slideIdx)"
                :src="resolveImageUrl(img)"
                mode="aspectFill"
                class="ad-slide-img"
                @error="onImageError(index, slideIdx)"
              />
              <view v-else class="ad-slide-placeholder">
                <text class="ad-slide-placeholder-text">图片加载失败</text>
              </view>

              <!-- 标题覆盖层 -->
              <view
                v-if="content.title"
                class="ad-title-overlay"
                :class="titleAlignClass(content)"
                :style="titleOverlayStyle(content)"
              >
                <text class="ad-title-text" :style="titleTextStyle(content)">{{ content.title }}</text>
              </view>
            </view>
```

- [ ] **Step 2: 为 .ad-slide-item 添加 position: relative**

使用 SearchReplace 工具，搜索：

```css
.ad-slide-item {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

替换为：

```css
.ad-slide-item {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}
```

---

## Task 4: 前端首页集成广告组件

**Files:**
- Modify: `d:\zhao\strapi-course\pages\index\index.vue`

- [ ] **Step 1: 在首页头部和搜索栏之间插入广告组件**

使用 SearchReplace 工具，搜索：

```vue
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
```

替换为：

```vue
    </view>

    <!-- 广告幻灯片 -->
    <ad-banner position="home-banner" />

    <!-- 搜索栏 -->
    <view class="search-bar">
```

uni-app easycom 自动引入 `components/ad-banner/ad-banner.vue`，无需手动 import。

---

## Task 5: 启动后端并验证种子数据

- [ ] **Step 1: 终止已运行的 Strapi 进程（如有）**

Run:
```powershell
$conns = Get-NetTCPConnection -LocalPort 1337 -ErrorAction SilentlyContinue
if ($conns) { $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }
```

- [ ] **Step 2: 启动 Strapi 后端**

Run (non-blocking, wait 30s):
```powershell
cd 'd:\zhao\strapi' ; npm run develop
```

- [ ] **Step 3: 检查控制台日志确认种子执行**

在 Strapi 启动日志中查找：
- `[zhao-studio] Starting ad data seed...`
- `[zhao-studio] Ad zone created: course-home-banner`
- `[zhao-studio] Ad content created: 首页轮播广告 (2 images)`
- `[zhao-studio] Ad data seed completed: 1 zone + 1 content (2 images)`

- [ ] **Step 4: 通过 API 验证广告数据**

Run:
```powershell
Invoke-RestMethod -Uri 'http://localhost:1337/api/zhao-studio/v1/ads/zones/home-banner' -Method Get | ConvertTo-Json -Depth 5
```
Expected:
- `data.zone.name` = "课程首页"
- `data.zone.code` = "course-home-banner"
- `data.zone.displayMode` = "slideshow"
- `data.contents` 数组长度 = 1
- `data.contents[0].title` = "精选好课 限时免费"
- `data.contents[0].images` 包含 2 个图片路径

- [ ] **Step 5: 验证图片可访问**

Run:
```powershell
Invoke-WebRequest -Uri 'http://localhost:1337/uploads/ads/banner-courses.jpg' -Method Head | Select-Object StatusCode
Invoke-WebRequest -Uri 'http://localhost:1337/uploads/ads/banner-points.jpg' -Method Head | Select-Object StatusCode
```
Expected: 两个请求均返回 StatusCode = 200

---

## Task 6: 验证管理后台编辑功能

- [ ] **Step 1: 确认管理后台广告区域列表**

在 strapi-backend 管理后台中：
1. 导航到广告区域列表页
2. 确认"课程首页"区域存在
3. 确认 displayMode 显示为"轮播"

- [ ] **Step 2: 编辑广告区域并保存**

1. 点击"课程首页"进入编辑页
2. 修改 description 字段
3. 保存，确认成功

- [ ] **Step 3: 确认广告内容**

1. 导航到广告内容列表页
2. 确认"首页轮播广告"内容存在
3. 确认关联的广告区域为"课程首页"

- [ ] **Step 4: 编辑广告内容并保存**

1. 点击"首页轮播广告"进入编辑页
2. 修改 title 字段，保存
3. 确认保存成功
4. 恢复原始 title 并保存

---

## Task 7: 验证前端 C 端广告展示

- [ ] **Step 1: 启动 strapi-course 前端**

Run (non-blocking, wait 15s):
```powershell
cd 'd:\zhao\strapi-course' ; npm run dev:h5
```

- [ ] **Step 2: 打开首页确认广告轮播显示**

在浏览器中打开 `http://localhost:5175/#/pages/index/index`，确认：
1. 头部下方、搜索栏上方显示广告轮播图
2. 2 张图片自动轮播，约 4 秒切换
3. 底部显示指示点（2 个圆点）
4. 每张图片底部叠加标题文字"精选好课 限时免费"
5. 点击轮播图跳转首页

- [ ] **Step 3: 验证条件显示 - 关闭广告区域**

1. 管理后台将广告区域 isActive 设为 false
2. 保存
3. 刷新前端首页
4. 确认广告幻灯片不显示

- [ ] **Step 4: 验证条件显示 - 重新启用**

1. 管理后台将 isActive 设回 true
2. 保存
3. 刷新前端首页
4. 确认广告轮播恢复显示

- [ ] **Step 5: 验证条件显示 - 关闭广告内容**

1. 管理后台将广告内容 isActive 设为 false
2. 刷新前端首页
3. 确认广告幻灯片不显示
4. 将 isActive 设回 true，刷新确认恢复
