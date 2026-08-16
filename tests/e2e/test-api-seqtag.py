"""直接测试公开 API 是否返回 sequenceTag"""
import requests

BASE = "http://localhost:1337/api"

# 不带 token 的公开请求
print("=== 公开 API（无 token） ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=5")
j = r.json()
for c in j.get('data', []):
    print(f"  {c.get('title')} | seqTag={c.get('sequenceTag')} | seqNum={c.get('sequenceNumber')} | enforce={c.get('enforceSequence')}")

# 带 token 的请求
print("\n=== 带 token 的请求 ===")
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA"
h = {"Authorization": f"Bearer {TOKEN}"}
r = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=5", headers=h)
j = r.json()
for c in j.get('data', []):
    tag = c.get('sequenceTag')
    tag_name = tag.get('name') if tag and isinstance(tag, dict) else tag
    print(f"  {c.get('title')} | seqTag={tag_name} | seqNum={c.get('sequenceNumber')} | enforce={c.get('enforceSequence')}")

# 测试 populate=*
print("\n=== 公开 API（populate=*） ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=5&populate=*")
j = r.json()
for c in j.get('data', []):
    tag = c.get('sequenceTag')
    tag_name = tag.get('name') if tag and isinstance(tag, dict) else tag
    print(f"  {c.get('title')} | seqTag={tag_name} | seqNum={c.get('sequenceNumber')} | enforce={c.get('enforceSequence')}")

# 测试课程详情
print("\n=== 课程详情 API ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses/ii0deg28vmbs5njac2p1i0o6")
j = r.json()
c = j.get('data', {})
tag = c.get('sequenceTag')
tag_name = tag.get('name') if tag and isinstance(tag, dict) else tag
print(f"  {c.get('title')} | seqTag={tag_name} | seqNum={c.get('sequenceNumber')} | lessons={len(c.get('lessons', []))}")
