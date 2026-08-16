"""验证播放页课时切换锁定和答题按钮"""
from playwright.sync_api import sync_playwright
import os

SCREENSHOT_DIR = "d:/zhao/strapi-course/tests/screenshots"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzg2Mzc3MTAxLCJleHAiOjE3ODg5NjkxMDF9.7sqJX0zzYyaTzHOhqAQVQJ-UemstRwzyLhTC1crrnqM"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 375, "height": 812})
    page = context.new_page()

    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

    # 注入 token
    page.goto('http://localhost:5175/', wait_until='domcontentloaded', timeout=30000)
    page.evaluate(f"""() => {{
        localStorage.setItem('token', '{TOKEN}');
        localStorage.setItem('user', JSON.stringify({{id:1, username:'admin', email:'johocn@163.com'}}));
    }}""")

    # === 验证1: 播放页课时切换锁定 ===
    print("=== 验证1: 播放页课时切换锁定 ===")
    # 访问顺序课程1的播放页
    page.goto('http://localhost:5175/#/pages/video-player/video-player?courseId=ii0deg28vmbs5njac2p1i0o6', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(4000)
    page.screenshot(path=f'{SCREENSHOT_DIR}/70-video-player.png', full_page=True)

    body_text = page.locator('body').inner_text()
    print(f"页面文本（前1500字符）:\n{body_text[:1500]}")

    # 检查课时列表
    print("\n--- 课时列表 ---")
    lessons = page.evaluate("""() => {
        const items = document.querySelectorAll('[class*="lesson-item"], .list-item, [class*="lesson"]');
        return Array.from(items).map(i => ({
            className: i.className,
            text: i.innerText.substring(0, 100)
        }));
    }""")
    for l in lessons[:10]:
        print(f"  {l['className']}: {l['text']}")

    # 尝试点击课时2（应被锁定，因为课时1未完成）
    print("\n--- 尝试点击课时2 ---")
    try:
        lesson2 = page.get_by_text("课程1-课时2", exact=False).first
        if lesson2.is_visible():
            lesson2.click()
            page.wait_for_timeout(2000)
            page.screenshot(path=f'{SCREENSHOT_DIR}/71-click-lesson2.png', full_page=True)

            # 检查锁定弹窗
            dialog = page.evaluate("""() => {
                const d = document.querySelector('.lock-dialog, [class*="lock-dialog"]');
                if (!d) return null;
                return {
                    text: d.innerText,
                    buttons: Array.from(d.querySelectorAll('[class*="btn"]')).map(b => b.innerText)
                };
            }""")
            if dialog:
                print(f"  ✓ 检测到锁定弹窗:\n{dialog['text']}")
                print(f"  按钮: {dialog['buttons']}")
            else:
                print("  ✗ 未检测到锁定弹窗")
                # 检查当前课时是否仍为课时1
                body = page.locator('body').inner_text()
                print(f"  当前页面文本片段: {body[:300]}")
    except Exception as e:
        print(f"  异常: {e}")

    # === 验证2: 答题按钮锁定 ===
    print("\n=== 验证2: 答题按钮锁定 ===")
    # 检查答题按钮状态
    quiz_btn = page.evaluate("""() => {
        const btns = document.querySelectorAll('[class*="quiz"], [class*="answer"], [class*="答题"]');
        return Array.from(btns).map(b => ({
            className: b.className,
            text: b.innerText.substring(0, 100),
            disabled: b.hasAttribute('disabled') || b.classList.contains('disabled')
        }));
    }""")
    print(f"答题按钮: {quiz_btn}")

    # === 验证3: quizRetryCount 显示 ===
    print("\n=== 验证3: quizRetryCount 配置 ===")
    # 顺序课程1的 quizRetryCount = no_retry (0)
    # 顺序课程2的 quizRetryCount = retry_1 (1)
    # 顺序课程3的 quizRetryCount = retry_2 (2)
    retry_info = page.evaluate("""() => {
        const text = document.body.innerText;
        const retryMatch = text.match(/retry[_\s]*(\d+)/i);
        return {
            hasRetryText: text.includes('再试一次') || text.includes('复答'),
            retryMatch: retryMatch ? retryMatch[0] : null
        };
    }""")
    print(f"复答信息: {retry_info}")

    # === 验证4: 检查错误日志 ===
    print("\n=== 验证4: 错误日志（过滤微信） ===")
    error_logs = [l for l in logs if l.startswith('[error]') and 'wx' not in l.lower() and 'jssdk' not in l.lower() and 'wechat' not in l.lower() and 'access_token' not in l.lower()]
    if error_logs:
        print(f"错误日志 ({len(error_logs)}):")
        for l in error_logs[:5]:
            print(f"  {l[:200]}")
    else:
        print("无业务相关错误日志")

    browser.close()
    print("\n=== 验证完成 ===")
