from playwright.sync_api import sync_playwright
import json

with open('d:/zhao/strapi-course/tests/e2e/.test_token', 'r') as f:
    token = f.read().strip()
user_data = {"id": 8, "username": "testuser1677", "email": "testuser1677@test.com"}

def check(vw, vh, label):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": vw, "height": vh}, device_scale_factor=2)
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

        img_wrap = page.locator('.poster-img')
        if img_wrap.count() > 0:
            inner = img_wrap.first.locator('img').first
            box = inner.bounding_box()
            container = page.locator('.poster-container').first.bounding_box()
            # 内容区：容器左 + 15px padding
            content_left = container['x'] + 15
            left_gap = box['x'] - content_left
            # 图片右边缘是否仍在容器内
            right_inside = box['x'] + box['width'] <= container['x'] + container['width'] - 15
            print(f"[{label}] 容器x={container['x']} 内容左={content_left:.0f} 图x={box['x']:.0f} 图宽={box['width']} 左侧间距={left_gap:.0f} 右侧在容器内={right_inside}")
        browser.close()

check(375, 812, "375x812")
check(375, 600, "375x600(矮屏-图片窄)")
check(430, 932, "430x932")