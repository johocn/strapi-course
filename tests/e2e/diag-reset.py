from playwright.sync_api import sync_playwright

COURSE_ID = "ii0deg28vmbs5njac2p1i0o6"
LESSON_ID = "w38nikam37hmjku0feds7x2a"
USERNAME = "admin"; PASSWORD = "Admin@12345"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:5175/#/", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(2000)
    page.locator("input").nth(0).fill(USERNAME)
    page.locator("input").nth(1).fill(PASSWORD)
    page.locator(".fallback-btn").click()
    page.wait_for_timeout(6000)

    # 1) 查进度记录 documentId
    res = page.evaluate("""async (courseId) => {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const r = await fetch('/api/zhao-course/v1/my/lesson-progresses?course='+courseId, {headers:{'Authorization':'Bearer '+token}}).then(x=>x.json());
      return { data: r.data, tokenType: token.slice(0,20) };
    }""", COURSE_ID)
    print("progress records:", [(p["documentId"], p["lesson"]["documentId"], p["progress"], p["playPosition"], p["isCompleted"]) for p in res["data"]])

    # 2) 用 admin 更新接口重置进度
    docId = res["data"][0]["documentId"]
    upd = page.evaluate("""async (args) => {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const r = await fetch('/api/zhao-course/v1/admin/lesson-progresses/'+args.docId, {
        method: 'PUT',
        headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({ data: { progress: 53, playPosition: 8, duration: 15, isCompleted: false } })
      });
      return { status: r.status, body: await r.text() };
    }""", {"docId": docId})
    print("admin update 53/8:", upd["status"], upd["body"][:300])

    # 3) 再查进度确认
    res2 = page.evaluate("""async (courseId) => {
      const token = localStorage.getItem('token') || localStorage.getItem('access_token') || '';
      const r = await fetch('/api/zhao-course/v1/my/lesson-progresses?course='+courseId, {headers:{'Authorization':'Bearer '+token}}).then(x=>x.json());
      return r.data;
    }""", COURSE_ID)
    print("after reset:", [(p["documentId"], p["progress"], p["playPosition"], p["isCompleted"]) for p in res2["data"]])
    browser.close()