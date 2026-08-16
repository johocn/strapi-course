"""独立验证：课1+课2 均完成后，进入页面应弹"去答题/从头开始"完成弹窗，并测试答题"""
from playwright.sync_api import sync_playwright
import subprocess

BASE = "http://localhost:5175"
COURSE_ID = "ii0deg28vmbs5njac2p1i0o6"
VIDEO_URL = f"{BASE}/#/pages/video-player/video-player?courseId={COURSE_ID}&lessonIndex=0"
USERNAME = "admin"; PASSWORD = "Admin@12345"
LESSON_RESUME = "cz26gyrt8sv2ta4rrh16q2h7"
LESSON_COMPLETED = "w38nikam37hmjku0feds7x2a"
RESET_CMD = ["node", "d:/zhao/strapi/tests/e2e/reset-progress.js"]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--autoplay-policy=no-user-gesture-required"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    logs = []
    page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    # 拦截 check-answer / start 请求，观察前端实际提交内容
    check_reqs = []
    quiz_title_by_doc = {
        "3c292a": "数据库(B)", "820a1e": "模块化(A)",
    }
    def on_req(req):
        try:
            if "zhao-quiz" in req.url and req.method == "POST":
                body = req.post_data or ""
                check_reqs.append((req.url, body))
        except Exception:
            pass
    page.on("request", on_req)
    check_resps = []
    def on_resp(resp):
        try:
            if "/zhao-quiz/v1/my/quiz/check-answer" in resp.url:
                # 异步读取 body 会阻塞，这里只记录状态；body 在后续单独取
                check_resps.append((resp.url, resp.request.post_data or ""))
        except Exception:
            pass
    page.on("response", on_resp)

    # 登录
    page.goto(f"{BASE}/#/", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(3000)
    # 等待登录表单 input 出现（可能默认进入 SSO/自动登录分支）
    try:
        page.wait_for_selector("input.form-input", timeout=15000)
    except Exception:
        print("!! 无 input.form-input，当前页面文本:", page.inner_text("body")[:300])
        page.screenshot(path="d:/zhao/strapi-course/tests/e2e/login_state.png")
    # 切换到"账号密码"tab（默认可能是"手机验证码"）
    pw_tab = page.locator(".login-tabs .tab-item", has_text="账号密码")
    if pw_tab.count():
        pw_tab.first.click(); page.wait_for_timeout(800)
    inputs = page.locator("input")
    print("input 数量:", inputs.count())
    if inputs.count() >= 2:
        inputs.nth(0).fill(USERNAME); inputs.nth(1).fill(PASSWORD)
        page.locator(".login-btn", has_text="登录").first.click()
    else:
        print("!! input 不足，无法登录")
    page.wait_for_timeout(8000)

    # 置两个课时为完成
    for doc in (LESSON_RESUME, LESSON_COMPLETED):
        r = subprocess.run(RESET_CMD + [doc, "100", "15", "true"], capture_output=True, text=True, cwd="d:/zhao/strapi")
        print("DB置完成:", (r.stdout or r.stderr).strip())

    # 打开视频页（全新加载）
    page.goto(VIDEO_URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(5000)

    has = page.locator(".resume-modal").count() > 0
    print("\n弹窗存在:", has)
    if has:
        print("弹窗内容:", page.locator(".resume-modal").inner_text().replace('\n',' | ')[:200])
        page.screenshot(path="d:/zhao/strapi-course/tests/e2e/completed_dialog.png")
    else:
        print("!! 无弹窗")
        page.screenshot(path="d:/zhao/strapi-course/tests/e2e/completed_nodialog.png")

    # 尝试去答题
    go_quiz = page.locator(".resume-btn.primary", has_text="去答题")
    if go_quiz.count():
        # 诊断：直接调用后端 startQuiz API，确认是否返回题目
        api_quiz = page.evaluate("""async () => {
          const token = localStorage.getItem('token') || '';
          const res = await fetch('/api/zhao-quiz/v1/my/quiz/start', {
            method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
            body: JSON.stringify({ lessonDocumentId: 'w38nikam37hmjku0feds7x2a', count: 2 })
          });
          const txt = await res.text(); let d=null; try{d=JSON.parse(txt);}catch(e){}
          return { status: res.status, body: txt.slice(0,800), data: d };
        }""")
        qz = api_quiz.get('data') or {}
        qs = (qz.get('data') or qz.get('questions'))
        print("\n** 后端 startQuiz 返回:", api_quiz.get('status'), "questions个数=", len(qs) if isinstance(qs, list) else 'N/A', (str(api_quiz.get('body'))[:400]))
        go_quiz.click()
        # 等待课时测验出现并加载选项
        try:
            page.wait_for_selector(".quiz-panel, .quiz-container, .quiz-title", timeout=5000)
        except Exception:
            pass
        page.wait_for_timeout(1500)
        print("出现课时测验:", "课时测验" in page.inner_text("body"))
        # 等待选项加载（可能是异步拉取题目）
        try:
            page.wait_for_selector(".option-item", timeout=8000)
        except Exception as e:
            print("选项等待超时:", e)
        opts = page.locator(".option-item")
        print("选项数:", opts.count())
        page.screenshot(path="d:/zhao/strapi-course/tests/e2e/quiz_loaded.png")
        if opts.count():
            # 完整作答流程：startQuiz 随机打乱题目，需根据题目标题动态判断答案
            for qi in range(2):
                page.wait_for_timeout(500)
                qtext = page.locator(".question-text").inner_text()
                # 规则：题目含"数据库"→B；含"模块化"→A
                correct = "B" if "数据库" in qtext else ("A" if "模块化" in qtext else "A")
                print(f"  第{qi+1}题题目: {qtext[:20]} 选择答案: {correct}")
                # 诊断：直接调用后端 check-answer 验证判题（固定题目 id 验证两个答案）
                api_check = page.evaluate("""async () => {
                  const token = localStorage.getItem('token') || '';
                  // 无法直接拿 vue 内部状态，改用固定题目 id 验证两个答案
                  const outs = [];
                  for (const [docId, ans] of [['3c292a44e57294c16a15e022','B'],['820a1e0cebac6be5848032b3','A']]) {
                    const res = await fetch('/api/zhao-quiz/v1/my/quiz/check-answer', {
                      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
                      body: JSON.stringify({ quizDocumentId: docId, userAnswer: ans })
                    });
                    const txt = await res.text(); let d=null; try{d=JSON.parse(txt);}catch(e){}
                    outs.push(docId.slice(0,6)+'/'+ans+' => '+(d && d.data ? JSON.stringify(d.data) : txt.slice(0,120)));
                  }
                  return outs.join('  ||  ');
                }""")
                print("   ** API判题诊断:", api_check)
                target = page.locator(f'.option-item:has(.option-key:text-is("{correct}"))')
                if not target.count():
                    # 遍历 option-item，按 option-key 精确匹配（uni-app H5 下 :has/text-is 可能失效）
                    clicked = False
                    for i in range(opts.count()):
                        key = opts.nth(i).locator(".option-key").inner_text().strip()
                        if key == correct:
                            opts.nth(i).click(); clicked = True; break
                    if not clicked:
                        opts.nth(0).click()
                else:
                    target.first.click()
                page.wait_for_timeout(300)
                sb = page.locator(".submit-btn")
                if sb.count(): sb.click()
                page.wait_for_timeout(1500)
                body = page.inner_text("body")
                print(f"第{qi+1}题答题结果:", [t for t in ["回答正确","回答错误","再试一次","下一题","完成答题"] if t in body])
                if qi < 1:
                    nx = page.locator(".next-btn")
                    if nx.count(): nx.click(); page.wait_for_timeout(800)
                else:
                    cm = page.locator(".complete-btn")
                    if cm.count(): cm.click(); page.wait_for_timeout(1500)
            page.screenshot(path="d:/zhao/strapi-course/tests/e2e/quiz2.png")
            print("\n   == 前端提交的 zhao-quiz POST 请求 ==")
            for url, body in check_reqs:
                print("   ", url.split("/api/")[-1], body[:200])
        else:
            # 打印题目区 HTML 帮助诊断
            quiz_html = page.locator("body").inner_html()
            import re
            seg = re.search(r"课时测验.{0,800}", quiz_html, re.S)
            print("!! 无选项，题目区片段:", (seg.group(0)[:600] if seg else quiz_html[:600]))
    else:
        print("无去答题按钮")

    print("\n=== DEBUG 日志 ===")
    for l in logs:
        if "DEBUG" in l: print(l[:300])
    browser.close()