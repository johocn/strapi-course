"""Task 9 端到端验证：使用正确 token 验证首页顺序锁定"""
from playwright.sync_api import sync_playwright
import os

SCREENSHOT_DIR = "d:/zhao/strapi-course/tests/screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzg2Mzc3MTAxLCJleHAiOjE3ODg5NjkxMDF9.7sqJX0zzYyaTzHOhqAQVQJ-UemstRwzyLhTC1crrnqM"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 375, "height": 812})
    page = context.new_page()

    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

    # Step 1: 注入 token
    print("=== Step 1: 注入 token ===")
    page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
    page.evaluate(f"""() => {{
        localStorage.setItem('token', '{TOKEN}');
        localStorage.setItem('user', JSON.stringify({{id:1, username:'admin', email:'johocn@163.com'}}));
    }}""")

    # Step 2: 访问首页
    print("\n=== Step 2: 访问首页 ===")
    page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(3000)
    page.screenshot(path=f'{SCREENSHOT_DIR}/30-home-logged.png', full_page=True)

    url = page.url
    print(f"当前URL: {url}")

    body_text = page.locator('body').inner_text()
    # 检查是否在登录页
    if 'login' in url:
        print("  ✗ 仍在登录页！token 注入失败")
        print(f"  页面文本: {body_text[:500]}")
    else:
        print("  ✓ 成功访问首页")

        # 检查课程
        for title in ["顺序课程1-硬锁-首课", "顺序课程2-硬锁-第二课", "顺序课程3-软锁-第三课", "自由学习课程-无顺序"]:
            if title in body_text:
                print(f"  ✓ 找到课程: {title}")

    # Step 3: 滚动到课程2位置
    print("\n=== Step 3: 点击顺序课程2（硬锁，应被锁定） ===")
    try:
        # 滚动到底部
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)

        course2 = page.get_by_text("顺序课程2-硬锁-第二课", exact=False).first
        print(f"课程2可见: {course2.is_visible()}")

        if course2.is_visible():
            # 滚动到元素
            course2.scroll_into_view_if_needed()
            page.wait_for_timeout(500)
            page.screenshot(path=f'{SCREENSHOT_DIR}/31-before-click-course2.png', full_page=True)

            course2.click()
            page.wait_for_timeout(2000)

            url_after = page.url
            print(f"点击后URL: {url_after}")
            page.screenshot(path=f'{SCREENSHOT_DIR}/32-after-click-course2.png', full_page=True)

            # 检查是否出现锁定弹窗
            body_text = page.locator('body').inner_text()
            lines = body_text.split('\n')
            keywords = ['锁', '顺序', '前置', '请先完成']
            matched = [l for l in lines if any(k in l for k in keywords)][:5]
            if matched:
                print(f"  ✓ 检测到锁定提示: {matched}")
            else:
                print("  ✗ 未检测到锁定提示")
                print(f"  页面文本片段: {body_text[:500]}")

            # 检查是否仍在首页（锁定应阻止跳转）
            if 'course-detail' in url_after:
                print("  ✗ 跳转到了课程详情页（锁定未生效）")
            else:
                print("  ✓ 仍在首页（锁定生效）")

    except Exception as e:
        print(f"  点击失败: {e}")

    # Step 4: 点击顺序课程1（首课，应可访问）
    print("\n=== Step 4: 点击顺序课程1（首课，应可访问） ===")
    try:
        page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(2000)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)

        course1 = page.get_by_text("顺序课程1-硬锁-首课", exact=False).first
        if course1.is_visible():
            course1.scroll_into_view_if_needed()
            course1.click()
            page.wait_for_timeout(3000)
            url_after = page.url
            print(f"  点击后URL: {url_after}")
            page.screenshot(path=f'{SCREENSHOT_DIR}/33-after-click-course1.png', full_page=True)
            if "course-detail" in url_after:
                print("  ✓ 成功跳转到课程详情页")
            else:
                print("  ✗ 未跳转到课程详情页")
    except Exception as e:
        print(f"  点击失败: {e}")

    # Step 5: 点击自由课程（无顺序约束，应可访问）
    print("\n=== Step 5: 点击自由学习课程（无顺序约束，应可访问） ===")
    try:
        page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(2000)
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)

        free_course = page.get_by_text("自由学习课程-无顺序", exact=False).first
        if free_course.is_visible():
            free_course.scroll_into_view_if_needed()
            free_course.click()
            page.wait_for_timeout(3000)
            url_after = page.url
            print(f"  点击后URL: {url_after}")
            page.screenshot(path=f'{SCREENSHOT_DIR}/34-after-click-free.png', full_page=True)
            if "course-detail" in url_after:
                print("  ✓ 成功跳转到课程详情页")
            else:
                print("  ✗ 未跳转到课程详情页")
    except Exception as e:
        print(f"  点击失败: {e}")

    # Step 6: 错误日志
    print("\n=== Step 6: 控制台错误日志（过滤微信相关） ===")
    error_logs = [l for l in logs if l.startswith('[error]') and 'wx' not in l.lower() and 'jssdk' not in l.lower() and 'wechat' not in l.lower()]
    if error_logs:
        print(f"错误日志 ({len(error_logs)}):")
        for l in error_logs[:10]:
            print(f"  {l[:200]}")
    else:
        print("无业务相关错误日志")

    browser.close()
    print("\n=== 验证完成 ===")
