import requests
import json
from urllib.parse import quote

BASE = "http://localhost:1337/api"
ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA"
h = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

# 1. 获取标签列表
print("=== 获取标签列表 ===")
r = requests.get(f"{BASE}/zhao-tag/v1/admin/tags?pagination[pageSize]=20", headers=h)
tags = r.json().get('data', [])
tag_doc_id = None
for t in tags:
    print(f"  [{t['documentId']}] {t.get('name')}")
    if '顺序' in (t.get('name') or ''):
        tag_doc_id = t['documentId']
print(f"使用的标签 documentId: {tag_doc_id}")

# 2. 更新课程1 - 不设置 sequenceTag，只设置标量字段
course1_id = "fc4m3ean4woec3m8tw6ur9z4"
print(f"\n=== 更新课程1 (只设标量字段) ===")
update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/courses/{course1_id}", json={
    "data": {
        "sequenceNumber": 1,
        "enforceSequence": True,
        "quizRetryCount": "retry_2",
        "allowRetakeQuiz": False
    }
}, headers=h)
print(f"更新: {update_resp.status_code}")
d = update_resp.json().get('data', {})
print(f"  seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, retry={d.get('quizRetryCount')}")

# 3. 设置 sequenceTag 关系（单独操作）
if tag_doc_id:
    print(f"\n=== 设置 sequenceTag 关系 (tag_doc_id={tag_doc_id}) ===")
    # 使用 Strapi v5 的关系更新格式：connect
    update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/courses/{course1_id}", json={
        "data": {
            "sequenceTag": tag_doc_id
        }
    }, headers=h)
    print(f"设置关系: {update_resp.status_code}")
    d = update_resp.json().get('data', {})
    tag_val = d.get('sequenceTag')
    print(f"  sequenceTag: {tag_val}")

# 4. 发布课程1
print(f"\n=== 发布课程1 ===")
pub_resp = requests.post(f"{BASE}/zhao-course/v1/admin/courses/{course1_id}/publish", headers=h)
print(f"发布: {pub_resp.status_code} {pub_resp.text[:200]}")

# 5. 验证公开 API
print(f"\n=== 公开 API 验证 ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses/{course1_id}?populate=*")
d = r.json().get('data', {})
tag_val = d.get('sequenceTag')
tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
print(f"课程1: seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, tag={tag_name}, retry={d.get('quizRetryCount')}")

# 6. 为新课程设置 sequenceTag 并发布
print("\n=== 设置新课程的 sequenceTag 并发布 ===")
for doc_id, seq_num, enforce, retry in [
    ("d2njr2ow0fzx", 2, True, "no_retry"),    # 测试顺序课程2-硬锁
    ("u1ca392294qt", 3, False, "retry_1"),     # 测试顺序课程3-软锁
]:
    if tag_doc_id:
        requests.put(f"{BASE}/zhao-course/v1/admin/courses/{doc_id}", json={
            "data": {"sequenceTag": tag_doc_id}
        }, headers=h)
    # 发布
    pub = requests.post(f"{BASE}/zhao-course/v1/admin/courses/{doc_id}/publish", headers=h)
    print(f"  [{doc_id[:12]}] 发布: {pub.status_code}")
    # 验证
    r = requests.get(f"{BASE}/zhao-course/v1/courses/{doc_id}?populate=*")
    d = r.json().get('data', {})
    tag_val = d.get('sequenceTag')
    tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
    print(f"    seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, tag={tag_name}, retry={d.get('quizRetryCount')}")

# 7. 为顺序课时设置 sequenceTag
print("\n=== 为顺序课时设置 sequenceTag ===")
r = requests.get(f"{BASE}/zhao-course/v1/admin/course-lessons?filters[course][documentId][$eq]={course1_id}&pagination[pageSize]=20", headers=h)
lessons = r.json().get('data', [])
for l in lessons:
    if '顺序课时' in (l.get('title') or ''):
        if tag_doc_id:
            update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/course-lessons/{l['documentId']}", json={
                "data": {"sequenceTag": tag_doc_id}
            }, headers=h)
            if update_resp.status_code == 200:
                d = update_resp.json().get('data', {})
                tag_val = d.get('sequenceTag')
                tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
                print(f"  {l.get('title')}: tag={tag_name}")
