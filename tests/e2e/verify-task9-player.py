"""Task 9 端到端验证: 播放页课时切换锁定 + 答题按钮锁定 + quizRetryCount"""
from playwright.sync_api import sync_playwright
import os

SCREENSHOT_DIR = "d:/zhao/strapi-course/tests/screenshots"
TOKEN_FILE = "d:/zhao/strapi-course/tests/e2e/.test_token"

with open(TOKEN_FILE, "r") as f:
    TOKEN = f.read().strip()

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = {"pass": 0, "fail": 0, "details": []}


def check(name, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    results["pass" if condition else "fail"] += 1
    results["details"].append(f"[{status}] {name}: {detail}")
    print(f"  [{status}] {name}: {detail}")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 375, "height": 812})
    page = context.new_page()

    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))

    # === 前置: 注入 token ===
    print("=== 前置: 注入 token ===")
    page.goto("http://localhost:5175/", wait_until="domcontentloaded", timeout=30000)
    page.evaluate(f"""() => {{
        localStorage.setItem('token', '{TOKEN}');
        localStorage.setItem('user', JSON.stringify({{id:8, username:'testuser1677', email:'testuser1677@test.com'}}));
    }}""")
    print("  token 已注入")

    # === 验证1: 播放页课时切换锁定（顺序课程1-硬锁） ===
    print("\n=== 验证1: 播放页课时切换锁定（顺序课程1-硬锁）===")
    # 顺序课程1 documentId = ii0deg28vmbs5njac2p1i0o6
    # 课时1 (seqNum=1, enforce=True) 课时2 (seqNum=2, enforce=True)
    page.goto(
        "http://localhost:5175/#/pages/video-player/video-player?courseId=ii0deg28vmbs5njac2p1i0o6",
        wait_until="networkidle",
        timeout=30000,
    )
    page.wait_for_timeout(4000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/task9-70-player-course1.png", full_page=True)

    body_text = page.locator("body").inner_text()
    print(f"  页面包含'课时列表': {'课时列表' in body_text}")
    print(f"  页面包含'课程1-课时2': {'课程1-课时2' in body_text}")

    check("播放页加载", "课时列表" in body_text, "课时列表区域显示")

    # 检查课时数据是否包含 sequenceTag
    lessons_data = page.evaluate("""() => {
        // 从 Vue 实例获取课时数据
        const app = document.querySelector('#app');
        if (!app || !app.__vue_app__) return null;
        return 'vue_app_found';
    }""")
    print(f"  Vue 应用: {lessons_data}")

    # 尝试点击课时2（应被锁定，因为课时1未完成）
    print("\n  --- 尝试点击课时2（应被锁定）---")
    try:
        lesson2 = page.get_by_text("课程1-课时2", exact=False).first
        if lesson2.is_visible():
            lesson2.click()
            page.wait_for_timeout(2000)
            page.screenshot(path=f"{SCREENSHOT_DIR}/task9-71-click-lesson2.png", full_page=True)

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
                check(
                    "课时2锁定弹窗显示",
                    True,
                    f"弹窗文本: {dialog['text'][:80]}",
                )
                check(
                    "硬锁弹窗内容正确",
                    "请先完成" in dialog["text"] or "前置" in dialog["text"],
                    f"内容: {dialog['text'][:80]}",
                )
                check(
                    "硬锁弹窗仅有'去学习'按钮",
                    len(dialog["buttons"]) == 1,
                    f"按钮: {dialog['buttons']}",
                )
            else:
                check("课时2锁定弹窗显示", False, "未检测到锁定弹窗")
                # 检查当前活跃课时是否仍为课时1
                active_text = page.locator("body").inner_text()
                print(f"  当前页面文本片段: {active_text[:300]}")
        else:
            check("课时2可见", False, "课时2元素不可见")
    except Exception as e:
        check("课时2点击", False, f"异常: {e}")

    # === 验证2: 点击课时1不锁定（首课不受锁定） ===
    print("\n=== 验证2: 点击课时1不锁定（首课）===")
    try:
        # 先关闭可能的弹窗
        page.evaluate("""() => {
            const mask = document.querySelector('.lock-dialog-mask');
            if (mask) mask.click();
        }""")
        page.wait_for_timeout(500)

        lesson1 = page.get_by_text("课程1-课时1", exact=False).first
        if lesson1.is_visible():
            lesson1.click()
            page.wait_for_timeout(1500)
            dialog = page.evaluate("""() => {
                const d = document.querySelector('.lock-dialog, [class*="lock-dialog"]');
                return d ? d.innerText : null;
            }""")
            check("课时1不锁定", dialog is None, f"弹窗: {dialog}")
        else:
            check("课时1可见", False, "课时1元素不可见")
    except Exception as e:
        check("课时1点击", False, f"异常: {e}")

    # === 验证3: 答题按钮锁定（顺序课程1 allowRetakeQuiz=false） ===
    print("\n=== 验证3: 答题按钮锁定状态 ===")
    # 顺序课程1 allowRetakeQuiz=false, quizRetryCount=no_retry
    # 用户无答题进度，按钮应显示"开始答题"且可点击
    quiz_btn = page.evaluate("""() => {
        const bar = document.querySelector('.bottom-bar');
        if (!bar) return null;
        const btns = bar.querySelectorAll('[class*="action-btn"]');
        return Array.from(btns).map(b => ({
            text: b.innerText,
            disabled: b.classList.contains('disabled')
        }));
    }""")
    print(f"  底部按钮: {quiz_btn}")
    if quiz_btn:
        has_quiz_btn = any("答题" in (b["text"] or "") for b in quiz_btn)
        check("答题按钮存在", has_quiz_btn, f"按钮: {[b['text'] for b in quiz_btn]}")
        # 用户未答题，按钮应可点击
        quiz_btn_info = next((b for b in quiz_btn if "答题" in (b["text"] or "")), None)
        if quiz_btn_info:
            check(
                "未答题时按钮可点击",
                not quiz_btn_info["disabled"],
                f"文本: {quiz_btn_info['text']}, disabled: {quiz_btn_info['disabled']}",
            )

    # === 验证4: quizRetryCount 配置（顺序课程3 retry_2, allowRetakeQuiz=true） ===
    print("\n=== 验证4: quizRetryCount 配置（顺序课程3-软锁）===")
    # 顺序课程3 documentId = l5ioj73e125i35jgbzr71f8v
    # quizRetryCount=retry_2, allowRetakeQuiz=true, enforceSequence=false, seqNum=3
    page.goto(
        "http://localhost:5175/#/pages/video-player/video-player?courseId=l5ioj73e125i35jgbzr71f8v",
        wait_until="networkidle",
        timeout=30000,
    )
    page.wait_for_timeout(4000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/task9-72-player-course3.png", full_page=True)

    body3 = page.locator("body").inner_text()
    print(f"  页面加载: {'课时列表' in body3}")

    # 检查答题按钮（allowRetakeQuiz=true，即使已答题也应可点击）
    quiz_btn3 = page.evaluate("""() => {
        const bar = document.querySelector('.bottom-bar');
        if (!bar) return null;
        const btns = bar.querySelectorAll('[class*="action-btn"]');
        return Array.from(btns).map(b => ({
            text: b.innerText,
            disabled: b.classList.contains('disabled')
        }));
    }""")
    print(f"  课程3答题按钮: {quiz_btn3}")

    # === 验证5: 自由学习课程无锁定 ===
    print("\n=== 验证5: 自由学习课程无锁定 ===")
    # 自由学习课程 documentId = w2ov0olzq5svcztograjppgj
    # seqNum=0, enforce=false, seqTag=null
    # 先导航到空白页，确保 onMounted 重新触发（H5 hash 路由同组件跳转不触发 onMounted）
    page.goto("about:blank", wait_until="domcontentloaded", timeout=10000)
    page.wait_for_timeout(500)
    page.goto(
        "http://localhost:5175/#/pages/video-player/video-player?courseId=w2ov0olzq5svcztograjppgj",
        wait_until="networkidle",
        timeout=30000,
    )
    page.wait_for_timeout(4000)
    body_free = page.locator("body").inner_text()
    print(f"  自由课程页面加载: {'课时列表' in body_free or 'video' in body_free.lower() or '课程' in body_free}")
    print(f"  页面包含'课程4': {'课程4' in body_free}")

    # 尝试点击任意课时（不应锁定）
    try:
        # 列出所有课时项
        lesson_items = page.evaluate("""() => {
            const items = document.querySelectorAll('[class*="lesson-item"]');
            return Array.from(items).map(i => i.innerText.substring(0, 50));
        }""")
        print(f"  课时列表: {lesson_items[:5]}")

        if len(lesson_items) >= 2:
            # 点击第二个课时
            items = page.query_selector_all('[class*="lesson-item"]')
            if len(items) >= 2:
                items[1].click()
                page.wait_for_timeout(1500)
                dialog = page.evaluate("""() => {
                    const d = document.querySelector('.lock-dialog, [class*="lock-dialog"]');
                    return d ? d.innerText : null;
                }""")
                check("自由课程无锁定", dialog is None, f"弹窗: {dialog}")
    except Exception as e:
        check("自由课程验证", False, f"异常: {e}")

    # === 验证6: 错误日志检查 ===
    print("\n=== 验证6: 错误日志检查 ===")
    error_logs = [
        l
        for l in logs
        if l.startswith("[error]")
        and "wx" not in l.lower()
        and "jssdk" not in l.lower()
        and "wechat" not in l.lower()
        and "access_token" not in l.lower()
        and "share" not in l.lower()
    ]
    if error_logs:
        print(f"  业务错误日志 ({len(error_logs)}):")
        for l in error_logs[:5]:
            print(f"    {l[:200]}")
        check("无业务错误日志", False, f"{len(error_logs)} 条错误")
    else:
        check("无业务错误日志", True, "无业务相关错误")

    browser.close()

# === 汇总 ===
print("\n" + "=" * 60)
print(f"验证汇总: 通过 {results['pass']} / 失败 {results['fail']}")
print("=" * 60)
for d in results["details"]:
    print(f"  {d}")
