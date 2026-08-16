from playwright.sync_api import sync_playwright
import json

with open('d:/zhao/strapi-course/tests/e2e/.test_token', 'r') as f:
    token = f.read().strip()
user_data = {"id": 8, "username": "testuser1677", "email": "testuser1677@test.com"}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 430, "height": 932}, device_scale_factor=2)
    page.goto('http://localhost:5175/#/pages/login/login')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)
    page.evaluate(f"localStorage.setItem('token', '{token}')")
    page.evaluate(f"localStorage.setItem('user', '{json.dumps(user_data)}')")
    page.evaluate("localStorage.setItem('token_expires_at', String(Date.now() + 3600000))")
    page.goto('http://localhost:5175/#/pages/profile/profile')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(4000)
    page.locator('text=生成海报').first.scroll_into_view_if_needed()
    page.locator('text=生成海报').first.click()
    page.wait_for_timeout(6000)

    # 测量 uni-image 包装层
    wrap = page.locator('.poster-img').first.bounding_box()
    inner = page.locator('.poster-img img').first.bounding_box()
    container = page.locator('.poster-container').first.bounding_box()
    print(f"容器: {container}")
    print(f".poster-img 包装: {wrap}")
    print(f"内部 img: {inner}")
    page.screenshot(path='d:/zhao/strapi-course/tests/screenshots/poster-see.png', full_page=True)
    browser.close()