"""Task 9 最终验证：先确认登录状态，再验证锁定"""
from playwright.sync_api import sync_playwright
import os

SCREENSHOT_DIR = "d:/zhao/strapi-course/tests/screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzg2Mzc3MTAxLCJleHAiOjE3ODg5NjkxMDF9.7sqJX0zzYyaTzHOhqAQVQJ-UemstRwzyLhTC1crrnqM"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 375, "height": 812})

    # 先设置 localStorage 再访问页面
    page = context.new_page()
    # 先访问一个空白页设置 localStorage
    page.goto('http://localhost:5175/', wait_until='domcontentloaded', timeout=30000)
    page.evaluate(f"""() => {{
        localStorage.setItem('token', '{TOKEN}');
        localStorage.setItem('user', JSON.stringify({{id:1, username:'admin', email:'johocn@163.com'}}));
    }}""")
    print("✓ Token 已注入 localStorage")

    # 等待一下再访问首页
    page.wait_for_timeout(1000)

    # Step 1: 访问首页
    print("\n=== Step 1: 访问首页 ===")
    page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(4000)
    page.screenshot(path=f'{SCREENSHOT_DIR}/40-home.png', full_page=True)

    url = page.url
    print(f"当前URL: {url}")

    if 'login' in url:
        print("  ✗ 仍在登录页")
        # 再次注入并刷新
        page.evaluate(f"""() => {{
            localStorage.setItem('token', '{TOKEN}');
            localStorage.setItem('user', JSON.stringify({{id:1, username:'admin', email:'johocn@163.com'}}));
        }}""")
        page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(4000)
        url = page.url
        print(f"  再次访问后URL: {url}")

    body_text = page.locator('body').inner_text()
    print(f"  页面包含'全部课程': {'全部课程' in body_text}")
    print(f"  页面包含'顺序课程1': {'顺序课程1' in body_text}")
    print(f"  页面包含'顺序课程2': {'顺序课程2' in body_text}")

    # Step 2: 点击顺序课程2（硬锁，应被锁定）
    print("\n=== Step 2: 点击顺序课程2（硬锁，应被锁定） ===")
    try:
        # 滚动找到课程2
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)

        course2 = page.get_by_text("顺序课程2-硬锁-第二课", exact=False).first
        visible = course2.is_visible()
        print(f"  课程2可见: {visible}")

        if visible:
            course2.scroll_into_view_if_needed()
            page.wait_for_timeout(500)
            url_before = page.url
            print(f"  点击前URL: {url_before}")

            course2.click()
            page.wait_for_timeout(3000)

            url_after = page.url
            print(f"  点击后URL: {url_after}")
            page.screenshot(path=f'{SCREENSHOT_DIR}/41-after-click-course2.png', full_page=True)

            body_text = page.locator('body').inner_text()
            lines = body_text.split('\n')
            keywords = ['锁', '顺序', '前置', '请先完成']
            matched = [l for l in lines if any(k in l for k in keywords)][:5]
            if matched:
                print(f"  ✓ 检测到锁定提示: {matched}")
            else:
                print("  ✗ 未检测到锁定提示")

            if 'course-detail' in url_after:
                print("  ✗ 跳转到了课程详情页（锁定未生效）")
            elif 'index' in url_after:
                print("  ✓ 仍在首页（锁定生效，未跳转）")
    except Exception as e:
        print(f"  异常: {e}")

    # Step 3: 点击顺序课程3（软锁，应提示但可跳过）
    print("\n=== Step 3: 点击顺序课程3（软锁，应提示可跳过） ===")
    try:
        page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(3000)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)

        course3 = page.get_by_text("顺序课程3-软锁-第三课", exact=False).first
        if course3.is_visible():
            course3.scroll_into_view_if_needed()
            course3.click()
            page.wait_for_timeout(3000)
            url_after = page.url
            print(f"  点击后URL: {url_after}")
            page.screenshot(path=f'{SCREENSHOT_DIR}/42-after-click-course3.png', full_page=True)

            body_text = page.locator('body').inner_text()
            lines = body_text.split('\n')
            keywords = ['锁', '顺序', '前置', '请先完成', '继续', '跳过']
            matched = [l for l in lines if any(k in l for k in keywords)][:5]
            if matched:
                print(f"  ✓ 检测到软锁提示: {matched}")
    except Exception as e:
        print(f"  异常: {e}")

    # Step 4: 点击顺序课程1（首课，应可访问）
    print("\n=== Step 4: 点击顺序课程1（首课，应可访问） ===")
    try:
        page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(3000)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)

        course1 = page.get_by_text("顺序课程1-硬锁-首课", exact=False).first
        if course1.is_visible():
            course1.scroll_into_view_if_needed()
            course1.click()
            page.wait_for_timeout(3000)
            url_after = page.url
            print(f"  点击后URL: {url_after}")
            page.screenshot(path=f'{SCREENSHOT_DIR}/43-after-click-course1.png', full_page=True)
            if "course-detail" in url_after:
                print("  ✓ 成功跳转到课程详情页")
    except Exception as e:
        print(f"  异常: {e}")

    browser.close()
    print("\n=== 验证完成 ===")
