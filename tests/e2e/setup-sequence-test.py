"""
Task 9 端到端验证：顺序锁定测试数据准备
创建 4 个课程：
  - 课程1: sequenceTag=A, sequenceNumber=1, enforceSequence=true (硬锁, 前置无)
  - 课程2: sequenceTag=A, sequenceNumber=2, enforceSequence=true (硬锁, 前置=课程1)
  - 课程3: sequenceTag=A, sequenceNumber=3, enforceSequence=false (软锁, 前置=课程1,2)
  - 课程4: sequenceTag=null (自由课程, 无顺序约束)
每个课程创建 2 个课时：
  - 课时1: sequenceNumber=1, enforceSequence=true
  - 课时2: sequenceNumber=2, enforceSequence=true (前置=课时1)
"""
import requests
import json
import time

BASE = "http://localhost:1337/api"
ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA"
h = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

# Step 1: 查询或创建顺序锁定测试 tag
print("=== Step 1: 查询/创建顺序锁定测试 tag ===")
r = requests.get(f"{BASE}/zhao-tag/v1/admin/tags?pagination[pageSize]=50", headers=h)
existing_tags = r.json().get('data', [])
seq_tag = None
for t in existing_tags:
    if t.get('name') == '顺序锁定测试组':
        seq_tag = t
        break
if seq_tag:
    print(f"  已存在 tag: id={seq_tag.get('documentId')}, name={seq_tag.get('name')}")
    tag_doc_id = seq_tag.get('documentId')
else:
    r = requests.post(f"{BASE}/zhao-tag/v1/admin/tags", json={
        "data": {"name": "顺序锁定测试组", "isPublic": True}
    }, headers=h)
    tag_doc_id = r.json().get('data', {}).get('documentId')
    print(f"  创建 tag: documentId={tag_doc_id}")

# Step 2: 查询现有课程
print("\n=== Step 2: 查询现有课程 ===")
r = requests.get(f"{BASE}/zhao-course/v1/admin/courses?pagination[pageSize]=50", headers=h)
existing_courses = r.json().get('data', [])
print(f"  现有课程数量: {len(existing_courses)}")
for c in existing_courses:
    print(f"  [{c.get('documentId','')[:12]}] {c.get('title')} | seqNum={c.get('sequenceNumber')} | enforce={c.get('enforceSequence')}")

# Step 3: 创建/更新 4 个课程
print("\n=== Step 3: 创建/更新测试课程 ===")

courses_config = [
    {"title": "顺序课程1-硬锁-首课", "sequenceNumber": 1, "enforceSequence": True, "quizRetryCount": "no_retry", "allowRetakeQuiz": False},
    {"title": "顺序课程2-硬锁-第二课", "sequenceNumber": 2, "enforceSequence": True, "quizRetryCount": "retry_1", "allowRetakeQuiz": False},
    {"title": "顺序课程3-软锁-第三课", "sequenceNumber": 3, "enforceSequence": False, "quizRetryCount": "retry_2", "allowRetakeQuiz": True},
    {"title": "自由学习课程-无顺序", "sequenceNumber": 0, "enforceSequence": False, "quizRetryCount": "no_retry", "allowRetakeQuiz": False},
]

course_doc_ids = []
for i, cfg in enumerate(courses_config):
    title = cfg["title"]
    # 查找现有课程
    existing = None
    for c in existing_courses:
        if c.get('title') == title:
            existing = c
            break

    data = {
        "title": title,
        "sequenceNumber": cfg["sequenceNumber"],
        "enforceSequence": cfg["enforceSequence"],
        "quizRetryCount": cfg["quizRetryCount"],
        "allowRetakeQuiz": cfg["allowRetakeQuiz"],
        "channelScope": "all",
        "status": "published",
    }
    # 前 3 个课程关联 sequenceTag
    if i < 3:
        data["sequenceTag"] = tag_doc_id

    if existing:
        doc_id = existing.get('documentId')
        r = requests.put(f"{BASE}/zhao-course/v1/admin/courses/{doc_id}", json={"data": data}, headers=h)
        print(f"  更新课程{i+1}: {r.status_code} - {title}")
        course_doc_ids.append(doc_id)
    else:
        r = requests.post(f"{BASE}/zhao-course/v1/admin/courses", json={"data": data}, headers=h)
        if r.status_code == 201:
            doc_id = r.json().get('data', {}).get('documentId')
            course_doc_ids.append(doc_id)
            print(f"  创建课程{i+1}: {r.status_code} - {title} (docId={doc_id})")
        else:
            print(f"  创建课程{i+1} 失败: {r.status_code} {r.text[:200]}")
            course_doc_ids.append(None)

    # 发布课程
    if course_doc_ids[-1]:
        pr = requests.post(f"{BASE}/zhao-course/v1/admin/courses/{course_doc_ids[-1]}/publish", headers=h)
        print(f"    发布: {pr.status_code}")
    time.sleep(0.3)

# Step 4: 为每个课程创建 2 个课时
print("\n=== Step 4: 创建课时 ===")

# 先查询现有课时
r = requests.get(f"{BASE}/zhao-course/v1/admin/course-lessons?pagination[pageSize]=100", headers=h)
existing_lessons = r.json().get('data', [])
print(f"  现有课时数量: {len(existing_lessons)}")

for ci, course_id in enumerate(course_doc_ids):
    if not course_id:
        continue
    print(f"\n  课程{ci+1} ({courses_config[ci]['title']}) 的课时:")
    for li in range(2):
        lesson_title = f"课程{ci+1}-课时{li+1}"
        # 查找现有课时
        existing_lesson = None
        for l in existing_lessons:
            if l.get('title') == lesson_title:
                existing_lesson = l
                break

        lesson_data = {
            "title": lesson_title,
            "type": "video",
            "duration": 300,
            "isRequired": True,
            "course": course_id,
            "sequenceNumber": li + 1,
            "enforceSequence": True if ci < 3 else False,  # 自由课程的课时也不锁定
        }
        # 顺序课程的课时也关联 sequenceTag
        if ci < 3:
            lesson_data["sequenceTag"] = tag_doc_id

        if existing_lesson:
            doc_id = existing_lesson.get('documentId')
            r = requests.put(f"{BASE}/zhao-course/v1/admin/course-lessons/{doc_id}", json={"data": lesson_data}, headers=h)
            print(f"    更新课时{li+1}: {r.status_code} - {lesson_title}")
        else:
            r = requests.post(f"{BASE}/zhao-course/v1/admin/course-lessons", json={"data": lesson_data}, headers=h)
            if r.status_code == 201:
                doc_id = r.json().get('data', {}).get('documentId')
                print(f"    创建课时{li+1}: {r.status_code} - {lesson_title} (docId={doc_id})")
            else:
                print(f"    创建课时{li+1} 失败: {r.status_code} {r.text[:200]}")
        time.sleep(0.2)

# Step 5: 汇总验证
print("\n=== Step 5: 汇总验证（公开 API） ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=20&populate=*")
courses = r.json().get('data', [])
print(f"公开课程数量: {len(courses)}")
for c in courses:
    tag_val = c.get('sequenceTag')
    tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
    lessons = c.get('lessons', [])
    print(f"  [{c.get('documentId','')[:12]}] {c.get('title')} | seqNum={c.get('sequenceNumber')} | enforce={c.get('enforceSequence')} | tag={tag_name} | retry={c.get('quizRetryCount')} | lessons={len(lessons) if lessons else 0}")

print("\n=== 测试数据准备完成 ===")
