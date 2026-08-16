import requests
import json

BASE = "http://localhost:1337/api"
ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA"
h = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

tag_doc_id = "fonc1jy34y6uiwhflwnytuvu"  # 顺序锁定测试组

# 1. 更新课程1 - 设置 title + 新字段 + sequenceTag
course1_id = "fc4m3ean4woec3m8tw6ur9z4"
print("=== 更新课程1 (title + 新字段 + sequenceTag) ===")
update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/courses/{course1_id}", json={
    "data": {
        "title": "测试视频课程",
        "sequenceNumber": 1,
        "enforceSequence": True,
        "quizRetryCount": "retry_2",
        "allowRetakeQuiz": False,
        "sequenceTag": tag_doc_id
    }
}, headers=h)
print(f"更新: {update_resp.status_code}")
d = update_resp.json().get('data', {})
print(f"  title={d.get('title')}, seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, retry={d.get('quizRetryCount')}")

# 2. 发布课程1
print("\n=== 发布课程1 ===")
pub_resp = requests.post(f"{BASE}/zhao-course/v1/admin/courses/{course1_id}/publish", headers=h)
print(f"发布: {pub_resp.status_code} {pub_resp.text[:200]}")

# 3. 验证公开 API
print("\n=== 公开 API 验证课程1 ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses/{course1_id}?populate=*")
d = r.json().get('data', {})
tag_val = d.get('sequenceTag')
tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
print(f"  title={d.get('title')}, seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, tag={tag_name}, retry={d.get('quizRetryCount')}")

# 4. 更新课程2 - 设置 sequenceTag 并发布
print("\n=== 更新课程2 (硬锁) ===")
c2_id = "d2njr2ow0fzx"
update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/courses/{c2_id}", json={
    "data": {
        "title": "测试顺序课程2-硬锁",
        "sequenceTag": tag_doc_id
    }
}, headers=h)
print(f"更新: {update_resp.status_code}")
pub_resp = requests.post(f"{BASE}/zhao-course/v1/admin/courses/{c2_id}/publish", headers=h)
print(f"发布: {pub_resp.status_code}")
r = requests.get(f"{BASE}/zhao-course/v1/courses/{c2_id}?populate=*")
d = r.json().get('data', {})
tag_val = d.get('sequenceTag')
tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
print(f"  title={d.get('title')}, seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, tag={tag_name}, retry={d.get('quizRetryCount')}")

# 5. 更新课程3 - 设置 sequenceTag 并发布
print("\n=== 更新课程3 (软锁) ===")
c3_id = "u1ca392294qt"
update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/courses/{c3_id}", json={
    "data": {
        "title": "测试顺序课程3-软锁",
        "sequenceTag": tag_doc_id
    }
}, headers=h)
print(f"更新: {update_resp.status_code}")
pub_resp = requests.post(f"{BASE}/zhao-course/v1/admin/courses/{c3_id}/publish", headers=h)
print(f"发布: {pub_resp.status_code}")
r = requests.get(f"{BASE}/zhao-course/v1/courses/{c3_id}?populate=*")
d = r.json().get('data', {})
tag_val = d.get('sequenceTag')
tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
print(f"  title={d.get('title')}, seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, tag={tag_name}, retry={d.get('quizRetryCount')}")

# 6. 更新自由课程 - 设置 title 并发布
print("\n=== 更新自由课程 ===")
c4_id = "ueoanbgwc7ah"
update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/courses/{c4_id}", json={
    "data": {
        "title": "自由学习课程"
    }
}, headers=h)
print(f"更新: {update_resp.status_code}")
pub_resp = requests.post(f"{BASE}/zhao-course/v1/admin/courses/{c4_id}/publish", headers=h)
print(f"发布: {pub_resp.status_code}")
r = requests.get(f"{BASE}/zhao-course/v1/courses/{c4_id}?populate=*")
d = r.json().get('data', {})
print(f"  title={d.get('title')}, seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}")

# 7. 汇总验证
print("\n=== 汇总：公开 API 所有课程 ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=20&populate=*")
courses = r.json().get('data', [])
for c in courses:
    tag_val = c.get('sequenceTag')
    tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
    print(f"  [{c.get('documentId')[:12]}] {c.get('title')} | seqNum={c.get('sequenceNumber')} | enforce={c.get('enforceSequence')} | tag={tag_name} | retry={c.get('quizRetryCount')}")
