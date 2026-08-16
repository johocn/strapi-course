"""查看锁定弹窗的具体内容"""
from playwright.sync_api import sync_playwright

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

    # 访问首页
    page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(4000)

    # 点击顺序课程2
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1000)
    course2 = page.get_by_text("顺序课程2-硬锁-第二课", exact=False).first
    course2.scroll_into_view_if_needed()
    course2.click()
    page.wait_for_timeout(2000)

    # 获取锁定弹窗内容
    dialog_content = page.evaluate("""() => {
        const dialog = document.querySelector('.lock-dialog, .lock-dialog-mask, [class*="lock-dialog"]');
        if (dialog) {
            return {
                className: dialog.className,
                text: dialog.innerText,
                html: dialog.innerHTML.substring(0, 1000)
            };
        }
        return null;
    }""")

    print("=== 锁定弹窗内容 ===")
    if dialog_content:
        print(f"类名: {dialog_content['className']}")
        print(f"文本:\n{dialog_content['text']}")
        print(f"\nHTML片段:\n{dialog_content['html']}")
    else:
        print("未找到锁定弹窗")
        body = page.locator('body').inner_text()
        print(f"页面文本:\n{body[:1500]}")

    # 截图
    page.screenshot(path='d:/zhao/strapi-course/tests/screenshots/50-lock-dialog.png', full_page=True)

    # 尝试点击弹窗按钮
    print("\n=== 弹窗按钮 ===")
    buttons = page.evaluate("""() => {
        const dialog = document.querySelector('.lock-dialog, [class*="lock-dialog"]');
        if (!dialog) return [];
        const btns = dialog.querySelectorAll('button, [class*="btn"], [class*="lock-btn"]');
        return Array.from(btns).map(b => ({
            className: b.className,
            text: b.innerText,
            tag: b.tagName
        }));
    }""")
    for b in buttons:
        print(f"  按钮: {b['tag']}.{b['className']} - '{b['text']}'")

    browser.close()
    print("\n=== 完成 ===")
