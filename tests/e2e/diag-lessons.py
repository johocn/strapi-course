from playwright.sync_api import sync_playwright

COURSE_ID = "ii0deg28vmbs5njac2p1i0o6"
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
      const q = 'filters[course][documentId][$eq]='+courseId+'&sort=sequenceNumber:asc';
      const r = await fetch('/api/zhao-course/v1/course-lessons?'+q).then(x=>x.json());
      return r.data.map(l => ({id:l.id, doc:l.documentId, title:l.title, seq:l.sequenceNumber, dur:l.duration, comp:l.completionThreshold}));
    }""", COURSE_ID)
    print("LESSONS in course:", res)
    browser.close()