"""Task 9 端到端验证：登录后验证首页和课程详情页的顺序锁定功能"""
from playwright.sync_api import sync_playwright
import os

SCREENSHOT_DIR = "d:/zhao/strapi-course/tests/screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 375, "height": 812})
    page = context.new_page()

    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

    # Step 1: 登录
    print("=== Step 1: 登录 ===")
    page.goto('http://localhost:5175/#/pages/login/login', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(2000)
    page.screenshot(path=f'{SCREENSHOT_DIR}/10-login.png', full_page=True)

    # 填写登录表单
    try:
        # 账号输入框
        account_input = page.locator('input[placeholder*="账号"], input[placeholder*="邮箱"]').first
        account_input.fill('admin')
        # 密码输入框
        password_input = page.locator('input[placeholder*="密码"], input[type="password"]').first
        password_input.fill('Admin@12345')
        page.wait_for_timeout(500)
        page.screenshot(path=f'{SCREENSHOT_DIR}/11-login-filled.png', full_page=True)

        # 点击登录按钮
        login_btn = page.get_by_text("登录", exact=True).first
        login_btn.click()
        page.wait_for_timeout(5000)
        page.screenshot(path=f'{SCREENSHOT_DIR}/12-after-login.png', full_page=True)
        print(f"  登录后URL: {page.url}")
    except Exception as e:
        print(f"  登录失败: {e}")
        # 尝试直接通过 API 登录并注入 token
        print("  尝试直接注入 token...")
        page.evaluate("""() => {
            const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA';
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify({id:1, username:'admin', email:'johocn@163.com'}));
        }""")
        page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(3000)

    # Step 2: 访问首页
    print("\n=== Step 2: 访问首页 ===")
    page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(3000)
    page.screenshot(path=f'{SCREENSHOT_DIR}/13-home.png', full_page=True)

    body_text = page.locator('body').inner_text()
    print(f"页面文本（前2000字符）:\n{body_text[:2000]}")

    # Step 3: 检查测试课程是否显示
    print("\n=== Step 3: 检查测试课程 ===")
    for title in ["顺序课程1-硬锁-首课", "顺序课程2-硬锁-第二课", "顺序课程3-软锁-第三课", "自由学习课程-无顺序"]:
        if title in body_text:
            print(f"  ✓ 找到课程: {title}")
        else:
            print(f"  ✗ 未找到课程: {title}")

    # Step 4: 滚动查看所有课程
    print("\n=== Step 4: 滚动查看所有课程 ===")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(2000)
    page.screenshot(path=f'{SCREENSHOT_DIR}/14-home-scroll.png', full_page=True)
    body_text2 = page.locator('body').inner_text()
    for title in ["顺序课程1-硬锁-首课", "顺序课程2-硬锁-第二课", "顺序课程3-软锁-第三课", "自由学习课程-无顺序"]:
        if title in body_text2:
            print(f"  ✓ 找到课程: {title}")

    # Step 5: 点击顺序课程2（硬锁，应该被锁定）
    print("\n=== Step 5: 点击顺序课程2（硬锁，应被锁定） ===")
    try:
        course2 = page.get_by_text("顺序课程2-硬锁-第二课", exact=False).first
        if course2.is_visible():
            course2.click()
            page.wait_for_timeout(2000)
            page.screenshot(path=f'{SCREENSHOT_DIR}/15-click-locked-course.png', full_page=True)
            dialog_text = page.locator('body').inner_text()
            lines = dialog_text.split('\n')
            keywords = ['锁', '顺序', '前置']
            matched = [l for l in lines if any(k in l for k in keywords)][:5]
            if matched:
                print(f"  ✓ 检测到锁定提示: {matched}")
            else:
                print("  ✗ 未检测到锁定提示")
            print(f"  当前URL: {page.url}")
        else:
            print("  课程2不可见")
    except Exception as e:
        print(f"  点击失败: {e}")

    # Step 6: 点击顺序课程1（首课，应可访问）
    print("\n=== Step 6: 点击顺序课程1（首课，应可访问） ===")
    try:
        page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(2000)
        course1 = page.get_by_text("顺序课程1-硬锁-首课", exact=False).first
        if course1.is_visible():
            course1.click()
            page.wait_for_timeout(3000)
            page.screenshot(path=f'{SCREENSHOT_DIR}/16-click-first-course.png', full_page=True)
            current_url = page.url
            print(f"  当前URL: {current_url}")
            if "course-detail" in current_url or "video-player" in current_url:
                print("  ✓ 成功跳转到课程详情/播放页")
            else:
                print("  未跳转到课程详情页")
    except Exception as e:
        print(f"  点击失败: {e}")

    # Step 7: 错误日志
    print("\n=== Step 7: 控制台错误日志 ===")
    error_logs = [l for l in logs if l.startswith('[error]')]
    if error_logs:
        print(f"错误日志 ({len(error_logs)}):")
        for l in error_logs[:5]:
            print(f"  {l[:200]}")
    else:
        print("无错误日志")

    browser.close()
    print("\n=== 验证完成 ===")
