from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 375, "height": 812})

    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: logs.append(f"[PAGEERROR] {err}"))

    print("=== Step 1: 设置游客状态并访问首页 ===")
    page.goto('http://localhost:5175/#/pages/index/index')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # 设置 isGuest 和 token（模拟游客模式）
    page.evaluate("localStorage.setItem('isGuest', 'true')")
    page.evaluate("localStorage.removeItem('token')")

    # 刷新页面
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(5000)
    page.screenshot(path='d:/zhao/strapi-course/tests/screenshots/02-home-guest.png', full_page=True)

    body_text = page.locator('body').inner_text()
    print(f"页面文本（前3000字符）:\n{body_text[:3000]}")

    # 查找课程卡片
    print("\n=== 查找课程元素 ===")
    for selector in ['.course-card', '.course-item', '.grid-card', '.list-card', '.card', '[class*="course"]', '[class*="card"]']:
        count = page.locator(selector).count()
        if count > 0:
            print(f"选择器 '{selector}' 找到 {count} 个元素")
            for i in range(min(count, 5)):
                el = page.locator(selector).nth(i)
                txt = el.inner_text()[:100].replace('\n', ' ')
                classes = el.get_attribute('class')
                print(f"  [{i}] class={classes} text={txt}")

    # 查看所有可点击的 view 元素（带 @click 的）
    print("\n=== 查找课程标题文本 ===")
    all_texts = page.locator('text').all()
    for el in all_texts:
        try:
            txt = el.inner_text().strip()
            if len(txt) > 5 and len(txt) < 100 and '课程' not in txt and '登录' not in txt and '圣麟' not in txt and 'SSO' not in txt and '账号' not in txt and '密码' not in txt:
                print(f"  text: {txt}")
        except:
            pass

    print("\n=== 控制台错误 ===")
    for log in logs[-10:]:
        if 'error' in log.lower() or 'PAGEERROR' in log:
            print(log[:300])

    browser.close()
