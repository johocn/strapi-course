from playwright.sync_api import sync_playwright
import sys

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    # 捕获控制台日志
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

    # 1. 访问首页
    print("=== Step 1: 访问首页 ===")
    page.goto('http://localhost:5175/#/pages/index/index')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)
    page.screenshot(path='d:/zhao/strapi-course/tests/screenshots/01-home.png', full_page=True)

    # 查看页面标题和课程卡片
    title = page.title()
    print(f"页面标题: {title}")

    # 查找所有课程卡片
    course_cards = page.locator('.course-card').all()
    print(f"课程卡片数量: {len(course_cards)}")

    # 尝试多种选择器
    all_views = page.locator('view').count()
    all_texts = page.locator('text').count()
    print(f"view 元素数量: {all_views}")
    print(f"text 元素数量: {all_texts}")

    # 打印页面部分文本内容以了解结构
    body_text = page.locator('body').inner_text()
    print(f"\n页面文本内容（前2000字符）:\n{body_text[:2000]}")

    browser.close()
