import requests
import json

BASE = "http://localhost:1337/api"
ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA"
h = {"Authorization": f"Bearer {ADMIN_TOKEN}"}

# 1. admin API 获取课程1详细数据
print("=== admin API 课程1 ===")
r = requests.get(f"{BASE}/zhao-course/v1/admin/courses/fc4m3ean4woec3m8tw6ur9z4", headers=h)
print(f"status: {r.status_code}")
d = r.json().get('data', {})
print(f"title: {d.get('title')}")
print(f"sequenceNumber: {d.get('sequenceNumber')}")
print(f"enforceSequence: {d.get('enforceSequence')}")
print(f"quizRetryCount: {d.get('quizRetryCount')}")
print(f"sequenceTag: {d.get('sequenceTag')}")
print(f"publishedAt: {d.get('publishedAt')}")

# 2. admin API 获取所有课程
print("\n=== admin API 所有课程 ===")
r = requests.get(f"{BASE}/zhao-course/v1/admin/courses?pagination[pageSize]=20", headers=h)
courses = r.json().get('data', [])
for c in courses:
    seq_tag = c.get('sequenceTag')
    tag_name = seq_tag.get('name') if seq_tag and isinstance(seq_tag, dict) else None
    print(f"  [{c['documentId'][:12]}] {c.get('title')} | publishedAt={c.get('publishedAt')} | seqNum={c.get('sequenceNumber',0)} | enforce={c.get('enforceSequence',False)} | tag={tag_name} | retry={c.get('quizRetryCount','N/A')}")

# 3. 检查公开 API 是否返回 sequenceTag
print("\n=== 公开 API 课程1 (populate=*) ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses/fc4m3ean4woec3m8tw6ur9z4?populate=*")
print(f"status: {r.status_code}")
d = r.json().get('data', {})
print(f"title: {d.get('title')}")
print(f"sequenceNumber: {d.get('sequenceNumber')}")
print(f"enforceSequence: {d.get('enforceSequence')}")
print(f"quizRetryCount: {d.get('quizRetryCount')}")
print(f"sequenceTag: {d.get('sequenceTag')}")
print(f"publishedAt: {d.get('publishedAt')}")
