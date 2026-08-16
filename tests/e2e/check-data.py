import requests
import json

BASE = "http://localhost:1337/api"

# 1. 获取课程列表（公开接口）
print("=== 获取课程列表 ===")
resp = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=20")
print(f"状态码: {resp.status_code}")
data = resp.json()
print(f"返回结构 keys: {list(data.keys()) if isinstance(data, dict) else type(data)}")
courses = data.get('data', []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
print(f"课程数量: {len(courses)}")
for c in courses:
    seq_tag = c.get('sequenceTag')
    seq_num = c.get('sequenceNumber', 0)
    enforce = c.get('enforceSequence', False)
    allow_retake = c.get('allowRetakeQuiz', False)
    retry_count = c.get('quizRetryCount', 'no_retry')
    tag_name = seq_tag.get('name') if seq_tag and isinstance(seq_tag, dict) else None
    print(f"  [{c.get('documentId')}] {c.get('title')} | seqNum={seq_num} | enforce={enforce} | tag={tag_name} | allowRetake={allow_retake} | retry={retry_count}")

# 2. 获取标签列表
print("\n=== 获取标签列表 ===")
resp = requests.get(f"{BASE}/zhao-tag/v1/tags?pagination[pageSize]=50")
data = resp.json()
tags = data.get('data', [])
print(f"标签数量: {len(tags)}")
for t in tags[:15]:
    print(f"  [{t.get('documentId')}] {t.get('name')}")

# 3. 注册测试用户
print("\n=== 注册/登录测试用户 ===")
import random
suffix = random.randint(1000, 9999)
reg_data = {
    "username": f"testuser{suffix}",
    "email": f"testuser{suffix}@test.com",
    "password": "Test123456"
}
resp = requests.post(f"{BASE}/zhao-auth/v1/register", json=reg_data)
print(f"注册状态码: {resp.status_code}")
if resp.status_code in (200, 201):
    result = resp.json()
    token = result.get('jwt') or result.get('access_token') or result.get('token')
    user = result.get('user') or result
    print(f"注册成功! token={token[:30] if token else 'None'}...")
    print(f"用户: {json.dumps(user, ensure_ascii=False)[:200]}")
elif resp.status_code == 400:
    # 用户已存在或其他错误，尝试登录
    print(f"注册失败: {resp.text[:200]}")
    # 尝试用已有账号登录
    login_data = {"identifier": reg_data["username"], "password": reg_data["password"]}
    resp = requests.post(f"{BASE}/zhao-auth/v1/login", json=login_data)
    print(f"登录状态码: {resp.status_code}")
    if resp.status_code == 200:
        result = resp.json()
        token = result.get('jwt') or result.get('access_token') or result.get('token')
        user = result.get('user') or result
        print(f"登录成功! token={token[:30] if token else 'None'}...")
    else:
        print(f"登录失败: {resp.text[:200]}")

# 保存 token 供后续使用
if token:
    with open('d:/zhao/strapi-course/tests/e2e/.test_token', 'w') as f:
        f.write(token)
    print(f"\nToken 已保存到 .test_token 文件")
