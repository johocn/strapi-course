"""验证课程详情页课时锁定和软锁跳过功能"""
from playwright.sync_api import sync_playwright
import os

SCREENSHOT_DIR = "d:/zhao/strapi-course/tests/screenshots"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzg2Mzc3MTAxLCJleHAiOjE3ODg5NjkxMDF9.7sqJX0zzYyaTzHOhqAQVQJ-UemstRwzyLhTC1crrnqM"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 375, "height": 812})
    page = context.new_page()

    # 注入 token
    page.goto('http://localhost:5175/', wait_until='domcontentloaded', timeout=30000)
    page.evaluate(f"""() => {{
        localStorage.setItem('token', '{TOKEN}');
        localStorage.setItem('user', JSON.stringify({{id:1, username:'admin', email:'johocn@163.com'}}));
    }}""")

    # === 验证1: 课程详情页课时锁定 ===
    print("=== 验证1: 课程详情页课时锁定 ===")
    # 访问顺序课程1的详情页（有2个课时，课时2依赖课时1）
    page.goto('http://localhost:5175/#/pages/course-detail/course-detail?courseId=ii0deg28vmbs5njac2p1i0o6', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(4000)
    page.screenshot(path=f'{SCREENSHOT_DIR}/60-course-detail.png', full_page=True)

    body_text = page.locator('body').inner_text()
    print(f"页面文本（前1500字符）:\n{body_text[:1500]}")

    # 检查课时列表
    print("\n--- 课时列表 ---")
    lessons = page.evaluate("""() => {
        const items = document.querySelectorAll('[class*="lesson"], [class*="课时"], .list-item');
        return Array.from(items).map(i => ({
            className: i.className,
            text: i.innerText.substring(0, 100)
        }));
    }""")
    for l in lessons[:10]:
        print(f"  {l['className']}: {l['text']}")

    # 检查锁图标
    print("\n--- 锁图标 ---")
    lock_icons = page.evaluate("""() => {
        const icons = document.querySelectorAll('[class*="lock"], [class*="锁"]');
        return Array.from(icons).map(i => ({
            className: i.className,
            text: i.innerText.substring(0, 50)
        }));
    }""")
    for icon in lock_icons[:10]:
        print(f"  {icon['className']}: {icon['text']}")

    # === 验证2: 软锁跳过功能 ===
    print("\n=== 验证2: 软锁跳过功能 ===")
    # 访问首页，点击顺序课程3（软锁）
    page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(3000)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1000)

    course3 = page.get_by_text("顺序课程3-软锁-第三课", exact=False).first
    if course3.is_visible():
        course3.scroll_into_view_if_needed()
        course3.click()
        page.wait_for_timeout(2000)
        page.screenshot(path=f'{SCREENSHOT_DIR}/61-soft-lock-dialog.png', full_page=True)

        # 获取软锁弹窗内容
        dialog = page.evaluate("""() => {
            const d = document.querySelector('.lock-dialog, [class*="lock-dialog"]');
            if (!d) return null;
            return {
                text: d.innerText,
                buttons: Array.from(d.querySelectorAll('[class*="btn"]')).map(b => b.innerText)
            };
        }""")
        if dialog:
            print(f"  软锁弹窗文本:\n{dialog['text']}")
            print(f"  按钮: {dialog['buttons']}")

            # 点击"继续学习"按钮（软锁应允许跳过）
            print("\n  --- 尝试点击'继续学习'按钮 ---")
            try:
                # 查找包含"继续"的按钮
                continue_btn = page.locator('.lock-dialog [class*="btn"]').filter(has_text="继续").first
                if continue_btn.is_visible():
                    continue_btn.click()
                    page.wait_for_timeout(3000)
                    url_after = page.url
                    print(f"  点击后URL: {url_after}")
                    page.screenshot(path=f'{SCREENSHOT_DIR}/62-after-soft-lock-skip.png', full_page=True)
                    if 'course-detail' in url_after:
                        print("  ✓ 软锁跳过成功，跳转到课程详情页")
                    else:
                        print("  ✗ 软锁跳过失败")
            except Exception as e:
                print(f"  点击继续按钮失败: {e}")
                # 尝试用 evaluate 直接点击
                skip_result = page.evaluate("""() => {
                    const btns = document.querySelectorAll('.lock-dialog [class*="btn"]');
                    for (const b of btns) {
                        if (b.innerText.includes('继续') || b.innerText.includes('跳过')) {
                            b.click();
                            return { clicked: true, text: b.innerText };
                        }
                    }
                    return { clicked: false, btns: Array.from(btns).map(b => b.innerText) };
                }""")
                print(f"  JS点击结果: {skip_result}")
                page.wait_for_timeout(3000)
                url_after = page.url
                print(f"  点击后URL: {url_after}")
                if 'course-detail' in url_after:
                    print("  ✓ 软锁跳过成功")
        else:
            print("  ✗ 未检测到软锁弹窗")
            body = page.locator('body').inner_text()
            print(f"  页面文本: {body[:500]}")

    browser.close()
    print("\n=== 验证完成 ===")
