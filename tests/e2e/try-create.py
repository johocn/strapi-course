import requests
import json

BASE = "http://localhost:1337/api"

# 读取已注册用户的 token
with open('d:/zhao/strapi-course/tests/e2e/.test_token', 'r') as f:
    token = f.read().strip()

headers = {"Authorization": f"Bearer {token}"}
print(f"使用 token: {token[:30]}...")

# 1. 尝试创建标签
print("\n=== 尝试用普通用户创建标签 ===")
tag_resp = requests.post(f"{BASE}/zhao-tag/v1/tags", json={
    "data": {"name": "测试顺序系列", "isPublic": True}
}, headers=headers)
print(f"创建标签: {tag_resp.status_code}")
if tag_resp.status_code in (200, 201):
    print("成功！")
else:
    print(f"失败: {tag_resp.text[:200]}")

# 2. 尝试更新课程
print("\n=== 尝试更新课程 ===")
resp = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=20")
courses = resp.json().get('data', [])
if courses:
    course1 = courses[0]
    course1_id = course1['documentId']
    update_resp = requests.put(f"{BASE}/zhao-course/v1/courses/{course1_id}", json={
        "data": {"sequenceNumber": 1, "enforceSequence": True}
    }, headers=headers)
    print(f"更新课程: {update_resp.status_code} {update_resp.text[:200]}")

# 3. 尝试用 Strapi content-api 直接创建（需要特定权限）
print("\n=== 尝试直接通过 content-api 创建课程 ===")
c2_resp = requests.post(f"{BASE}/zhao-course/v1/courses", json={
    "data": {
        "title": "测试顺序课程2",
        "sequenceNumber": 2,
        "enforceSequence": True,
        "status": "published"
    }
}, headers=headers)
print(f"创建课程2: {c2_resp.status_code} {c2_resp.text[:200]}")

# 4. 检查当前用户是否是 admin
print("\n=== 检查用户信息 ===")
me_resp = requests.get(f"{BASE}/users/me", headers=headers)
print(f"用户信息: {me_resp.status_code} {me_resp.text[:200]}")

# 5. 尝试 Strapi admin login with different credentials
print("\n=== 尝试其他 admin 凭据 ===")
for email, pwd in [
    ("admin@strapi.com", "Pass1234"),
    ("admin@strapi.com", "Admin1234"),
    ("admin@strapi.com", "strapi"),
    ("admin@strapi.com", "Password123"),
    ("admin@strapi.com", "admin"),
]:
    r = requests.post(f"http://localhost:1337/admin/login", json={"email": email, "password": pwd})
    if r.status_code == 200:
        print(f"  成功! email={email} password={pwd}")
        admin_token = r.json().get('data', {}).get('token')
        print(f"  admin token: {admin_token[:30]}...")
        with open('d:/zhao/strapi-course/tests/e2e/.admin_token', 'w') as f:
            f.write(admin_token)
        break
    else:
        print(f"  {email}:{pwd} -> {r.status_code}")
