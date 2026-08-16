from playwright.sync_api import sync_playwright

BASE = "http://localhost:5175"
COURSE_ID = "ii0deg28vmbs5njac2p1i0o6"
VIDEO_URL = f"{BASE}/#/pages/video-player/video-player?courseId={COURSE_ID}&lessonIndex=0"
USERNAME = "admin"; PASSWORD = "Admin@12345"

# 课2：无进度（用于"续播"场景，可新建 53%/8s 记录）
LESSON_RESUME = "cz26gyrt8sv2ta4rrh16q2h7"
# 课1：已是 100%（用于"完成后去答题"场景）
LESSON_COMPLETED = "w38nikam37hmjku0feds7x2a"

def login(page):
    page.goto(f"{BASE}/#/", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)
    try:
        # 切换到"账号密码"tab（默认是"手机验证码"，第一个 input 是手机号 type=number）
        pw_tab = page.locator(".login-tabs .tab-item", has_text="账号密码")
        if pw_tab.count():
            pw_tab.first.click(); page.wait_for_timeout(500)
        # 账号密码 tab 下：第一个 input 为账号，第二个为密码
        inputs = page.locator("input")
        inputs.nth(0).fill(USERNAME)
        inputs.nth(1).fill(PASSWORD)
        page.locator(".login-btn", has_text="登录").first.click()
    except Exception as e:
        print("登录失败", e)
    page.wait_for_timeout(6000)

def open_video(page, ts=None):
    url = VIDEO_URL if ts is None else f"{VIDEO_URL}&ts={ts}"
    page.goto(url, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(4000)

def set_progress(page, lessonId, progressPct, playPosition):
    return page.evaluate("""async (args) => {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/zhao-course/v1/my/lesson-progress', {
        method: 'POST',
        headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({ lessonDocumentId: args.lessonId, progress: args.progress, playPosition: args.pos, duration: 15 })
      });
      const txt = await res.text(); let data=null; try{data=JSON.parse(txt);}catch(e){}
      return { status: res.status, body: txt, data };
    }""", {"lessonId": lessonId, "progress": progressPct, "pos": playPosition})

def has_dialog(page):
    return page.locator(".resume-modal").count() > 0

def dialog_text(page):
    m = page.locator(".resume-modal")
    return m.inner_text().replace('\n',' | ')[:200] if m.count() else "无"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    logs = []
    page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    login(page)

    # ============ 场景A：有进度未完成 → 续播弹窗（从 X 继续 / 从头） ============
    print("\n=== 场景A: 课2 进度 53% / 播放位置 8s ===")
    # 后端只增不减，用 DB 直接把课2重置为"未完成 53%/8s"
    import subprocess, os
    RESET_CMD = ["node", "d:/zhao/strapi/tests/e2e/reset-progress.js"]
    reset = subprocess.run(RESET_CMD + [LESSON_RESUME, "53", "8", "false"],
                           capture_output=True, text=True, cwd="d:/zhao/strapi")
    print("  DB重置课2:", (reset.stdout or reset.stderr).strip())
    open_video(page)
    print("  续播弹窗存在:", has_dialog(page))
    print("  弹窗内容:", dialog_text(page))
    page.screenshot(path="d:/zhao/strapi-course/tests/e2e/resume_dialog.png")

    continue_btn = page.locator(".resume-btn.primary", has_text="继续播放")
    if has_dialog(page) and continue_btn.count():
        continue_btn.click(); page.wait_for_timeout(1500)
        cur = page.evaluate("() => { const v=document.querySelector('video'); return v?{t:Math.round(v.currentTime),paused:v.paused}:null; }")
        print("  点[继续播放]后 video:", cur, "(期望 currentTime≈8 且 播放中)")
    else:
        # 兜底：点从头开始关闭弹窗
        restart = page.locator(".resume-btn", has_text="从头开始播放")
        if restart.count(): restart.click(); page.wait_for_timeout(800)
        print("  !! 未出现续播弹窗")

    # 关闭当前弹窗（若还在）
    if has_dialog(page):
        page.locator(".resume-btn", has_text="从头开始播放").click(); page.wait_for_timeout(800)

    # 重要：先卸载场景A页面（goto 会触发 onUnmounted 上报低进度，污染 DB），
    # 再 reset DB，最后打开页面，否则 reset 会被旧页面的上报覆盖
    page.goto(f"{BASE}/#/", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)

    # ============ 场景B：全部完成 → 完成弹窗（去答题 / 从头） + 答题 ============
    print("\n=== 场景B: 课1+课2 均完成 → 去答题 ===")
    for doc, p, pos, done in [(LESSON_RESUME, 100, 15, True), (LESSON_COMPLETED, 100, 15, True)]:
        r = subprocess.run(RESET_CMD + [doc, str(p), str(pos), "true"],
                           capture_output=True, text=True, cwd="d:/zhao/strapi")
        print("  DB置完成:", (r.stdout or r.stderr).strip())
    # 直接调后端 API 验证返回的进度（排除缓存/前端问题）
    api_prog = page.evaluate("""async () => {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/zhao-course/v1/my/lesson-progresses?course=ii0deg28vmbs5njac2p1i0o6', {
        headers: {'Authorization':'Bearer '+token}
      });
      const txt = await res.text(); let d=null; try{d=JSON.parse(txt);}catch(e){}
      return { status: res.status, body: txt.slice(0,600), data: d };
    }""")
    print("  ** 后端 myProgresses 返回:", (api_prog.get('data') or api_prog.get('body')))
    open_video(page, ts="B")
    print("  ** 弹窗(任意)存在:", has_dialog(page))
    print("  ** 弹窗内容:", dialog_text(page))
    page.screenshot(path="d:/zhao/strapi-course/tests/e2e/completed_dialog.png")

    go_quiz = page.locator(".resume-btn.primary", has_text="去答题")
    if has_dialog(page) and go_quiz.count():
        go_quiz.click(); page.wait_for_timeout(2500)
        print("  出现课时测验:", "课时测验" in page.inner_text("body"))
        opts = page.locator(".option-item")
        print("  选项数=", opts.count())
        if opts.count():
            opts.nth(0).click(); page.wait_for_timeout(300)
            page.locator(".submit-btn").click(); page.wait_for_timeout(2000)
            body = page.inner_text("body")
            print("  答题结果:", [t for t in ["回答正确","回答错误","再试一次","下一题","完成答题"] if t in body])
            page.screenshot(path="d:/zhao/strapi-course/tests/e2e/quiz.png")
        else:
            page.screenshot(path="d:/zhao/strapi-course/tests/e2e/quiz_noopt.png")
    else:
        print("  !! 未出现完成弹窗/去答题按钮")

    print("\n=== CONSOLE (DEBUG 相关) ===")
    for l in logs:
        if "DEBUG" in l: print(l)
    print("\n=== CONSOLE (后 15) ===")
    for l in logs[-15:]: print(l)
    browser.close()