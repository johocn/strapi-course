import requests
import json

BASE = "http://localhost:1337/api"
ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA"
h = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

# 获取标签 documentId
print("=== 获取标签 ===")
r = requests.get(f"{BASE}/zhao-tag/v1/tags?filters[name][\$eq]=顺序锁定测试组")
tag_data = r.json().get('data', [])
tag_doc_id = tag_data[0]['documentId'] if tag_data else None
print(f"标签 documentId: {tag_doc_id}")

# 获取课程列表
print("\n=== 获取课程列表 ===")
r = requests.get(f"{BASE}/zhao-course/v1/admin/courses?pagination[pageSize]=20", headers=h)
courses = r.json().get('data', [])
for c in courses:
    print(f"  [{c['documentId'][:12]}] {c.get('title')} | seqNum={c.get('sequenceNumber')} | enforce={c.get('enforceSequence')}")

# 更新课程1 - 使用 documentId 格式设置关系
course1_id = courses[0]['documentId']
print(f"\n=== 更新课程1 ({course1_id}) ===")

# 尝试不同的关系设置格式
for fmt_name, seq_tag_value in [
    ("documentId string", tag_doc_id),
    ("documentId array", [tag_doc_id]),
    ("object with documentId", {"documentId": tag_doc_id}),
    ("array of objects", [{"documentId": tag_doc_id}]),
]:
    print(f"\n尝试格式: {fmt_name}")
    update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/courses/{course1_id}", json={
        "data": {
            "sequenceNumber": 1,
            "enforceSequence": True,
            "sequenceTag": seq_tag_value,
            "quizRetryCount": "retry_2",
            "allowRetakeQuiz": False
        }
    }, headers=h)
    if update_resp.status_code == 200:
        d = update_resp.json().get('data', {})
        tag_val = d.get('sequenceTag')
        tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
        print(f"  seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, tag={tag_name}, retry={d.get('quizRetryCount')}")
        if tag_name:
            print(f"  ✓ 关系设置成功!")
            break
    else:
        print(f"  失败: {update_resp.status_code} {update_resp.text[:200]}")

# 发布课程1
print("\n=== 发布课程1 ===")
pub_resp = requests.post(f"{BASE}/zhao-course/v1/admin/courses/{course1_id}/publish", headers=h)
print(f"发布: {pub_resp.status_code}")

# 验证公开 API
print("\n=== 公开 API 验证 ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses/{course1_id}?populate=*")
d = r.json().get('data', {})
tag_val = d.get('sequenceTag')
tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
print(f"课程1: seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, tag={tag_name}, retry={d.get('quizRetryCount')}")

# 为新创建的课时设置 sequenceTag
print("\n=== 为顺序课时设置 sequenceTag ===")
r = requests.get(f"{BASE}/zhao-course/v1/admin/course-lessons?filters[course][documentId][\$eq]={course1_id}&pagination[pageSize]=20", headers=h)
lessons = r.json().get('data', [])
for l in lessons:
    if '顺序课时' in l.get('title', ''):
        update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/course-lessons/{l['documentId']}", json={
            "data": {
                "sequenceTag": tag_doc_id
            }
        }, headers=h)
        if update_resp.status_code == 200:
            d = update_resp.json().get('data', {})
            tag_val = d.get('sequenceTag')
            tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
            print(f"  {l.get('title')}: tag={tag_name}")
