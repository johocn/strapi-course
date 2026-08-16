"""Task 9 端到端验证：使用浏览器自动化验证首页和课程详情页的顺序锁定功能"""
from playwright.sync_api import sync_playwright
import time

SCREENSHOT_DIR = "d:/zhao/strapi-course/tests/screenshots"
import os
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 375, "height": 812})
    page = context.new_page()

    # 捕获控制台日志和网络请求
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

    api_responses = []
    def on_response(response):
        if "/api/zhao-course" in response.url:
            try:
                body = response.text()[:500]
                api_responses.append(f"{response.status} {response.url}\n  body: {body}")
            except:
                api_responses.append(f"{response.status} {response.url}")
    page.on("response", on_response)

    # Step 1: 访问首页
    print("=== Step 1: 访问首页 ===")
    page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(3000)
    page.screenshot(path=f'{SCREENSHOT_DIR}/01-home.png', full_page=True)

    body_text = page.locator('body').inner_text()
    print(f"页面文本（前1500字符）:\n{body_text[:1500]}")

    # Step 2: 检查课程卡片
    print("\n=== Step 2: 检查课程卡片 ===")
    # 尝试多种选择器
    for selector in ['.course-card', '[class*="course"]', '.list-item', 'uni-view[class*="card"]']:
        cards = page.locator(selector).all()
        if cards:
            print(f"选择器 '{selector}' 找到 {len(cards)} 个元素")
            break

    # 打印 API 响应
    print("\n=== API 响应 ===")
    for r in api_responses[:5]:
        print(r)

    # Step 3: 滚动查看所有课程
    print("\n=== Step 3: 滚动查看所有课程 ===")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(2000)
    page.screenshot(path=f'{SCREENSHOT_DIR}/02-home-scroll.png', full_page=True)

    body_text2 = page.locator('body').inner_text()
    # 检查是否包含测试课程
    for title in ["顺序课程1-硬锁-首课", "顺序课程2-硬锁-第二课", "顺序课程3-软锁-第三课", "自由学习课程-无顺序"]:
        if title in body_text2:
            print(f"  ✓ 找到课程: {title}")
        else:
            print(f"  ✗ 未找到课程: {title}")

    # Step 4: 点击顺序课程2（硬锁，应该被锁定，因为课程1未完成）
    print("\n=== Step 4: 点击顺序课程2（硬锁，应被锁定） ===")
    try:
        # 查找包含"顺序课程2"的元素并点击
        course2 = page.get_by_text("顺序课程2-硬锁-第二课", exact=False).first
        if course2.is_visible():
            course2.click()
            page.wait_for_timeout(2000)
            page.screenshot(path=f'{SCREENSHOT_DIR}/03-click-locked-course.png', full_page=True)
            # 检查是否出现锁定弹窗
            dialog_text = page.locator('body').inner_text()
            if "锁" in dialog_text or "顺序" in dialog_text or "前置" in dialog_text:
                print("  ✓ 检测到锁定提示")
                # 截取弹窗内容
                lines = dialog_text.split('\n')
                keywords = ['锁', '顺序', '前置']
                matched = [l for l in lines if any(k in l for k in keywords)][:5]
                print(f"  弹窗文本片段: {matched}")
            else:
                print("  ✗ 未检测到锁定提示")
        else:
            print("  课程2不可见")
    except Exception as e:
        print(f"  点击失败: {e}")

    # Step 5: 点击顺序课程1（首课，应可访问）
    print("\n=== Step 5: 点击顺序课程1（首课，应可访问） ===")
    try:
        course1 = page.get_by_text("顺序课程1-硬锁-首课", exact=False).first
        if course1.is_visible():
            course1.click()
            page.wait_for_timeout(3000)
            page.screenshot(path=f'{SCREENSHOT_DIR}/04-click-first-course.png', full_page=True)
            current_url = page.url
            print(f"  当前URL: {current_url}")
            if "course-detail" in current_url or "video-player" in current_url:
                print("  ✓ 成功跳转到课程详情/播放页")
            else:
                print("  未跳转到课程详情页")
    except Exception as e:
        print(f"  点击失败: {e}")

    # Step 6: 打印控制台错误日志
    print("\n=== Step 6: 控制台日志 ===")
    error_logs = [l for l in logs if l.startswith('[error]')]
    if error_logs:
        print(f"错误日志 ({len(error_logs)}):")
        for l in error_logs[:10]:
            print(f"  {l}")
    else:
        print("无错误日志")

    browser.close()
    print("\n=== 验证完成 ===")
