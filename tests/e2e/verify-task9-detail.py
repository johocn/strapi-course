"""Task 9 详细验证：点击课程2时的锁定行为"""
from playwright.sync_api import sync_playwright
import os

SCREENSHOT_DIR = "d:/zhao/strapi-course/tests/screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 375, "height": 812})
    page = context.new_page()

    # 注入 token
    page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
    page.evaluate("""() => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA';
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify({id:1, username:'admin', email:'johocn@163.com'}));
    }""")

    # 重新加载首页
    page.goto('http://localhost:5175/#/pages/index/index', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(3000)

    # 检查课程列表是否包含 sequenceTag 数据
    print("=== 检查课程数据（通过 API） ===")
    api_data = page.evaluate("""async () => {
        const r = await fetch('http://localhost:1337/api/zhao-course/v1/courses?pagination[pageSize]=20', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        const j = await r.json();
        return j.data.map(c => ({
            title: c.title,
            documentId: c.documentId,
            sequenceNumber: c.sequenceNumber,
            enforceSequence: c.enforceSequence,
            sequenceTag: c.sequenceTag ? c.sequenceTag.name : null,
            quizRetryCount: c.quizRetryCount
        }));
    }""")
    print(f"API 返回课程数: {len(api_data)}")
    for c in api_data:
        print(f"  {c['title']} | seqNum={c['sequenceNumber']} | enforce={c['enforceSequence']} | tag={c['sequenceTag']} | retry={c['quizRetryCount']}")

    # 检查课程进度
    print("\n=== 检查课程进度 ===")
    progress_data = page.evaluate("""async () => {
        try {
            const r = await fetch('http://localhost:1337/api/zhao-course/v1/course-progress/my', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            const text = await r.text();
            return { status: r.status, body: text.substring(0, 500) };
        } catch (e) {
            return { error: e.message };
        }
    }""")
    print(f"课程进度 API: {progress_data}")

    # 检查前端 courseList 的实际数据
    print("\n=== 检查前端 courseList 数据 ===")
    frontend_data = page.evaluate("""() => {
        // 尝试从 Vue 实例获取数据
        const app = document.querySelector('#app');
        if (app && app.__vue_app__) {
            return 'Vue app found';
        }
        return 'No Vue app found';
    }""")
    print(f"前端状态: {frontend_data}")

    # 点击顺序课程2
    print("\n=== 点击顺序课程2 ===")
    course2 = page.get_by_text("顺序课程2-硬锁-第二课", exact=False).first
    print(f"课程2可见: {course2.is_visible()}")

    # 监听点击后的 URL 变化和弹窗
    url_before = page.url
    print(f"点击前 URL: {url_before}")

    course2.click()
    page.wait_for_timeout(2000)

    url_after = page.url
    print(f"点击后 URL: {url_after}")

    page.screenshot(path=f'{SCREENSHOT_DIR}/20-after-click-course2.png', full_page=True)

    # 检查是否有锁定弹窗
    body_text = page.locator('body').inner_text()
    print(f"\n页面文本（前1000字符）:\n{body_text[:1000]}")

    # 检查是否有 sequence-lock-dialog
    dialog_visible = page.evaluate("""() => {
        const dialogs = document.querySelectorAll('.sequence-lock-dialog, [class*="lock-dialog"], [class*="dialog"]');
        return Array.from(dialogs).map(d => ({
            className: d.className,
            visible: d.offsetParent !== null,
            text: d.innerText.substring(0, 200)
        }));
    }""")
    print(f"\n弹窗元素: {dialog_visible}")

    browser.close()
    print("\n=== 验证完成 ===")
