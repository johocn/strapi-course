"""通过 API 登录获取正确 token，然后验证首页顺序锁定"""
import requests
import json

BASE = "http://localhost:1337/api"
FRONTEND = "http://localhost:5175"

# Step 1: 通过 API 登录获取 token
print("=== Step 1: 登录获取 token ===")
login_resp = requests.post(f"{BASE}/auth/local", json={
    "identifier": "admin",
    "password": "Admin@12345"
})
print(f"登录状态: {login_resp.status_code}")
if login_resp.status_code != 200:
    print(f"登录失败: {login_resp.text[:300]}")
    exit(1)

login_data = login_resp.json()
token = login_data.get('jwt')
user = login_data.get('user')
print(f"  token: {token[:50]}...")
print(f"  user: {user.get('username')} (id={user.get('id')})")

# Step 2: 用 token 测试公开 API
print("\n=== Step 2: 测试公开 API ===")
h = {"Authorization": f"Bearer {token}"}
r = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=20", headers=h)
courses = r.json().get('data', [])
print(f"课程数量: {len(courses)}")
for c in courses:
    tag = c.get('sequenceTag')
    tag_name = tag.get('name') if tag and isinstance(tag, dict) else None
    print(f"  {c.get('title')} | seqNum={c.get('sequenceNumber')} | enforce={c.get('enforceSequence')} | tag={tag_name} | retry={c.get('quizRetryCount')}")

# Step 3: 测试课程进度 API
print("\n=== Step 3: 测试课程进度 API ===")
progress_endpoints = [
    '/zhao-course/v1/my/course-progresses',
    '/zhao-course/v1/course-progress/my',
    '/zhao-course/v1/course-progress',
]
for ep in progress_endpoints:
    r = requests.get(f"{BASE}{ep}", headers=h)
    print(f"  {ep}: {r.status_code} {r.text[:150]}")

# Step 4: 测试 course-progress 路由
print("\n=== Step 4: 测试 course-progress 路由 ===")
r = requests.get(f"{BASE}/zhao-course/v1/my/courses", headers=h)
print(f"  /my/courses: {r.status_code} {r.text[:200]}")

print("\n=== Token 获取完成 ===")
print(f"\nTOKEN={token}")
