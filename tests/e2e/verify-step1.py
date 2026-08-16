from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 375, "height": 812})

    # 捕获控制台日志和错误
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: logs.append(f"[PAGEERROR] {err}"))

    print("=== Step 1: 访问登录页 ===")
    page.goto('http://localhost:5175/#/pages/login/login')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    # 点击游客体验
    guest_btn = page.locator('text=游客体验')
    print(f"游客体验按钮数量: {guest_btn.count()}")
    if guest_btn.count() > 0:
        guest_btn.first.click()
        page.wait_for_timeout(1000)
        # 确认弹窗
        confirm_btn = page.locator('text=确定')
        if confirm_btn.count() > 0:
            confirm_btn.first.click()
        page.wait_for_timeout(2000)

    print("=== Step 2: 进入首页 ===")
    page.goto('http://localhost:5175/#/pages/index/index')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(5000)
    page.screenshot(path='d:/zhao/strapi-course/tests/screenshots/02-home-guest.png', full_page=True)

    body_text = page.locator('body').inner_text()
    print(f"首页文本内容（前3000字符）:\n{body_text[:3000]}")

    # 查找课程卡片 - 尝试多种选择器
    for selector in ['.course-card', '.course-item', '[class*="course"]', '[class*="card"]']:
        count = page.locator(selector).count()
        if count > 0:
            print(f"\n选择器 '{selector}' 找到 {count} 个元素")

    # 查看 DOM 结构
    html = page.content()
    # 查找包含"课程"文本的元素
    course_texts = page.locator('text=/课程/').all()
    print(f"\n包含'课程'文本的元素数量: {len(course_texts)}")
    for i, el in enumerate(course_texts[:10]):
        try:
            txt = el.inner_text()
            print(f"  [{i}] {txt[:100]}")
        except:
            pass

    print("\n=== Step 3: 尝试点击第一个课程 ===")
    # 查找可点击的课程项
    all_clickable = page.locator('[class*="course"], [class*="card"], [class*="item"]').all()
    print(f"可点击候选元素数量: {len(all_clickable)}")
    for i, el in enumerate(all_clickable[:5]):
        try:
            classes = el.get_attribute('class')
            txt = el.inner_text()[:80]
            print(f"  [{i}] class={classes} text={txt}")
        except:
            pass

    # 打印错误日志
    print("\n=== 控制台错误日志 ===")
    for log in logs:
        if 'error' in log.lower() or 'PAGEERROR' in log:
            print(log[:200])

    browser.close()
