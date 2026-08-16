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

    res = page.evaluate("""async (courseId) => {
      const token = localStorage.getItem('token') || '';
      let out = {};
      const lessons = await fetch('/api/zhao-course/v1/course-lessons?course='+courseId, {headers:{'Authorization':'Bearer '+token}}).then(r=>r.json());
      out.lessons = JSON.stringify(lessons).slice(0, 1500);
      const prog = await fetch('/api/zhao-course/v1/my/lesson-progresses?course='+courseId, {headers:{'Authorization':'Bearer '+token}}).then(r=>r.json());
      out.progress = JSON.stringify(prog).slice(0, 1500);
      return out;
    }""", COURSE_ID)
    print("=== LESSONS ===")
    print(res["lessons"])
    print("\n=== PROGRESS ===")
    print(res["progress"])
    browser.close()