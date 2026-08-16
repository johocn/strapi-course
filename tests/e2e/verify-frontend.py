from playwright.sync_api import sync_playwright
import json

# 读取 token
with open('d:/zhao/strapi-course/tests/e2e/.test_token', 'r') as f:
    token = f.read().strip()

user_data = {"id": 8, "username": "testuser1677", "email": "testuser1677@test.com"}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 375, "height": 812})

    # 捕获所有控制台日志和错误
    all_logs = []
    page.on("console", lambda msg: all_logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: all_logs.append(f"[PAGEERROR] {err}"))

    # 1. 先访问页面设置 token
    print("=== Step 1: 设置 token 并登录 ===")
    page.goto('http://localhost:5175/#/pages/login/login')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # 设置 localStorage（uni-app H5 使用 localStorage）
    page.evaluate(f"localStorage.setItem('token', '{token}')")
    page.evaluate(f"localStorage.setItem('user', '{json.dumps(user_data)}')")
    page.evaluate("localStorage.setItem('points', '0')")
    page.evaluate("localStorage.setItem('token_expires_at', String(Date.now() + 3600000))")

    # 2. 访问首页
    print("\n=== Step 2: 访问首页 ===")
    page.goto('http://localhost:5175/#/pages/index/index')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(5000)
    page.screenshot(path='d:/zhao/strapi-course/tests/screenshots/03-home-logged-in.png', full_page=True)

    body_text = page.locator('body').inner_text()
    print(f"页面文本（前2000字符）:\n{body_text[:2000]}")

    # 查找课程卡片
    print("\n=== 查找课程卡片 ===")
    for selector in ['.course-card', '.course-item', '.grid-card', '.list-card', '[class*="card"]', '[class*="course-item"]']:
        count = page.locator(selector).count()
        if count > 0:
            print(f"选择器 '{selector}' 找到 {count} 个元素")
            for i in range(min(count, 5)):
                el = page.locator(selector).nth(i)
                txt = el.inner_text()[:120].replace('\n', ' ')
                classes = el.get_attribute('class')
                print(f"  [{i}] class={classes} text={txt}")

    # 3. 检查锁定弹窗是否存在（如果课程有 sequenceTag 但未配置则不会出现）
    lock_dialog = page.locator('.lock-dialog-mask, [class*="lock"]')
    print(f"\n锁定弹窗数量: {lock_dialog.count()}")

    # 4. 检查 SequenceLockDialog 组件是否渲染
    dialog_component = page.locator('.lock-dialog')
    print(f"SequenceLockDialog 组件: {dialog_component.count()}")

    # 5. 打印错误日志
    print("\n=== JavaScript 错误日志 ===")
    errors = [log for log in all_logs if 'error' in log.lower() or 'PAGEERROR' in log]
    for err in errors:
        print(err[:300])

    # 6. 打印所有日志（调试用）
    print(f"\n=== 所有控制台日志（共{len(all_logs)}条）===")
    for log in all_logs[-15:]:
        print(log[:200])

    browser.close()
