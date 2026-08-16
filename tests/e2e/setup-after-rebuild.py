import requests
import json
import sys
import time

BASE = "http://localhost:1337/api"
ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA"
h = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

# 等待 Strapi 就绪
print("=== 等待 Strapi 启动 ===")
for i in range(30):
    try:
        r = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=1", timeout=5)
        if r.status_code == 200:
            print(f"Strapi 已就绪 (尝试 {i+1} 次)")
            break
    except:
        pass
    time.sleep(3)
else:
    print("Strapi 未就绪，请确认已重启")
    sys.exit(1)

# 1. 创建顺序标签
print("\n=== 创建顺序标签 ===")
tag_resp = requests.post(f"{BASE}/zhao-tag/v1/admin/tags", json={
    "data": {"name": "顺序锁定测试组", "isPublic": True}
}, headers=h)
print(f"创建标签: {tag_resp.status_code}")
if tag_resp.status_code not in (200, 201):
    print(f"  响应: {tag_resp.text[:300]}")
    # 可能已存在，尝试获取
    r = requests.get(f"{BASE}/zhao-tag/v1/tags?filters[name][$eq]=顺序锁定测试组")
    tag_data = r.json().get('data', [])
    if tag_data:
        tag_doc_id = tag_data[0]['documentId']
        print(f"  使用已有标签: {tag_doc_id}")
    else:
        sys.exit(1)
else:
    tag_data = tag_resp.json().get('data', {})
    tag_doc_id = tag_data.get('documentId')
print(f"标签 documentId: {tag_doc_id}")

# 2. 获取现有课程
print("\n=== 获取现有课程 ===")
resp = requests.get(f"{BASE}/zhao-course/v1/admin/courses?pagination[pageSize]=20", headers=h)
courses = resp.json().get('data', [])
print(f"现有课程: {len(courses)}")
for c in courses:
    print(f"  [{c['documentId'][:12]}] {c.get('title')} | seqNum={c.get('sequenceNumber',0)} | enforce={c.get('enforceSequence',False)}")

# 3. 为现有课程配置 sequenceNumber=1
course1_id = None
if courses and tag_doc_id:
    course1 = courses[0]
    course1_id = course1['documentId']
    print(f"\n配置课程1 ({course1.get('title')}) sequenceNumber=1, enforceSequence=true")
    update_resp = requests.put(f"{BASE}/zhao-course/v1/admin/courses/{course1_id}", json={
        "data": {
            "sequenceNumber": 1,
            "enforceSequence": True,
            "sequenceTag": tag_doc_id,
            "quizRetryCount": "retry_2",
            "allowRetakeQuiz": False
        }
    }, headers=h)
    print(f"  更新课程1: {update_resp.status_code}")
    if update_resp.status_code == 200:
        d = update_resp.json().get('data', {})
        print(f"  验证: seqNum={d.get('sequenceNumber')}, enforce={d.get('enforceSequence')}, retry={d.get('quizRetryCount')}, tag={d.get('sequenceTag')}")

# 4. 创建课程2（硬锁）
print("\n创建课程2 (sequenceNumber=2, 硬锁)")
c2_resp = requests.post(f"{BASE}/zhao-course/v1/admin/courses", json={
    "data": {
        "title": "测试顺序课程2-硬锁",
        "description": "顺序锁定测试课程2",
        "sequenceNumber": 2,
        "enforceSequence": True,
        "sequenceTag": tag_doc_id,
        "quizRetryCount": "no_retry",
        "isFree": True
    }
}, headers=h)
print(f"  创建课程2: {c2_resp.status_code}")
c2_data = c2_resp.json().get('data', {}) if c2_resp.status_code in (200, 201) else {}
c2_id = c2_data.get('documentId')
if c2_id:
    print(f"  验证: seqNum={c2_data.get('sequenceNumber')}, enforce={c2_data.get('enforceSequence')}")
    requests.post(f"{BASE}/zhao-course/v1/admin/courses/{c2_id}/publish", headers=headers)

# 5. 创建课程3（软锁）
print("\n创建课程3 (sequenceNumber=3, 软锁)")
c3_resp = requests.post(f"{BASE}/zhao-course/v1/admin/courses", json={
    "data": {
        "title": "测试顺序课程3-软锁",
        "description": "顺序锁定软锁测试",
        "sequenceNumber": 3,
        "enforceSequence": False,
        "sequenceTag": tag_doc_id,
        "quizRetryCount": "retry_1",
        "isFree": True
    }
}, headers=h)
print(f"  创建课程3: {c3_resp.status_code}")
c3_data = c3_resp.json().get('data', {}) if c3_resp.status_code in (200, 201) else {}
c3_id = c3_data.get('documentId')
if c3_id:
    print(f"  验证: seqNum={c3_data.get('sequenceNumber')}, enforce={c3_data.get('enforceSequence')}")
    requests.post(f"{BASE}/zhao-course/v1/admin/courses/{c3_id}/publish", headers=h)

# 6. 创建自由课程
print("\n创建自由课程（无顺序锁定）")
c4_resp = requests.post(f"{BASE}/zhao-course/v1/admin/courses", json={
    "data": {
        "title": "自由学习课程",
        "description": "无顺序限制",
        "sequenceNumber": 0,
        "enforceSequence": False,
        "quizRetryCount": "no_retry",
        "isFree": True
    }
}, headers=h)
print(f"  创建自由课程: {c4_resp.status_code}")
c4_data = c4_resp.json().get('data', {}) if c4_resp.status_code in (200, 201) else {}
c4_id = c4_data.get('documentId')
if c4_id:
    requests.post(f"{BASE}/zhao-course/v1/admin/courses/{c4_id}/publish", headers=h)

# 7. 为课程1创建课时
if course1_id and tag_doc_id:
    print(f"\n=== 为课程1创建3个顺序课时 ===")
    for title, seq_num, enforce in [
        ("顺序课时1-入门", 1, True),
        ("顺序课时2-基础", 2, True),
        ("顺序课时3-进阶", 3, True)
    ]:
        lesson_resp = requests.post(f"{BASE}/zhao-course/v1/admin/course-lessons", json={
            "data": {
                "title": title,
                "duration": 300,
                "sequenceNumber": seq_num,
                "enforceSequence": enforce,
                "sequenceTag": tag_doc_id,
                "isRequired": True,
                "course": course1_id,
                "type": "video"
            }
        }, headers=h)
        ld = lesson_resp.json().get('data', {}) if lesson_resp.status_code in (200, 201) else {}
        print(f"  创建{title}: {lesson_resp.status_code} | seqNum={ld.get('sequenceNumber')}, enforce={ld.get('enforceSequence')}")

# 8. 验证
print("\n=== 最终验证课程列表 ===")
resp = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=20&populate=*")
courses = resp.json().get('data', [])
for c in courses:
    seq_tag = c.get('sequenceTag')
    tag_name = seq_tag.get('name') if seq_tag and isinstance(seq_tag, dict) else None
    print(f"  [{c.get('documentId')[:12]}] {c.get('title')} | seqNum={c.get('sequenceNumber',0)} | enforce={c.get('enforceSequence',False)} | tag={tag_name} | retry={c.get('quizRetryCount','N/A')}")

if course1_id:
    print(f"\n=== 验证课程1的课时 ===")
    resp = requests.get(f"{BASE}/zhao-course/v1/course-lessons?filters[course][documentId][$eq]={course1_id}&populate=*")
    lessons = resp.json().get('data', [])
    for l in lessons:
        seq_tag = l.get('sequenceTag')
        tag_name = seq_tag.get('name') if seq_tag and isinstance(seq_tag, dict) else None
        print(f"  [{l.get('documentId')[:12]}] {l.get('title')} | seqNum={l.get('sequenceNumber',0)} | enforce={l.get('enforceSequence',False)} | tag={tag_name}")
