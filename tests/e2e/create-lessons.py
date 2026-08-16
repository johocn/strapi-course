"""为已创建的 4 个测试课程创建课时"""
import requests
import time

BASE = "http://localhost:1337/api"
ADMIN_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2hvY25AMTYzLmNvbSIsInVzZXJuYW1lIjoiYWRtaW4iLCJ6aGFvUm9sZXMiOlsiYWRtaW4iXSwiY3VycmVudFRlbmFudElkIjoid2I4ZnBibnllOGo4MWQwdnJneWNtZGVqIiwiaWF0IjoxNzg2MzcyOTg0LCJleHAiOjE3ODg5NjQ5ODR9.ZaCoC9xLyrdGDMqrv-b5oPXb5__2Ytw9-o-myValBiA"
h = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}

# 查询现有课程
r = requests.get(f"{BASE}/zhao-course/v1/admin/courses?pagination[pageSize]=50", headers=h)
all_courses = r.json().get('data', [])

# 目标课程
target_titles = ["顺序课程1-硬锁-首课", "顺序课程2-硬锁-第二课", "顺序课程3-软锁-第三课", "自由学习课程-无顺序"]
tag_doc_id = "fonc1jy34y6uiwhflwnytuvu"  # 顺序锁定测试组

# 查询现有课时
r = requests.get(f"{BASE}/zhao-course/v1/admin/course-lessons?pagination[pageSize]=100", headers=h)
existing_lessons = r.json().get('data', [])
print(f"现有课时数量: {len(existing_lessons)}")

# 为每个课程创建 2 个课时
for title in target_titles:
    course = None
    for c in all_courses:
        if c.get('title') == title:
            course = c
            break
    if not course:
        print(f"未找到课程: {title}")
        continue

    course_id = course.get('documentId')
    course_idx = target_titles.index(title)
    print(f"\n课程{course_idx+1}: {title} (docId={course_id})")

    for li in range(2):
        lesson_title = f"课程{course_idx+1}-课时{li+1}"
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
            "enforceSequence": True if course_idx < 3 else False,
        }
        if course_idx < 3:
            lesson_data["sequenceTag"] = tag_doc_id

        if existing_lesson:
            doc_id = existing_lesson.get('documentId')
            r = requests.put(f"{BASE}/zhao-course/v1/admin/course-lessons/{doc_id}", json={"data": lesson_data}, headers=h)
            print(f"  更新课时{li+1}: {r.status_code} - {lesson_title}")
        else:
            r = requests.post(f"{BASE}/zhao-course/v1/admin/course-lessons", json={"data": lesson_data}, headers=h)
            if r.status_code == 201:
                print(f"  创建课时{li+1}: {r.status_code} - {lesson_title}")
            else:
                print(f"  创建课时{li+1} 失败: {r.status_code} {r.text[:200]}")
        time.sleep(0.2)

# 验证课时
print("\n=== 验证课时 ===")
r = requests.get(f"{BASE}/zhao-course/v1/admin/course-lessons?pagination[pageSize]=100", headers=h)
lessons = r.json().get('data', [])
print(f"课时总数: {len(lessons)}")
for l in lessons:
    course = l.get('course')
    course_title = course.get('title') if course and isinstance(course, dict) else '?'
    print(f"  [{l.get('documentId','')[:12]}] {l.get('title')} | seqNum={l.get('sequenceNumber')} | enforce={l.get('enforceSequence')} | course={course_title}")

# 验证公开 API 课程详情
print("\n=== 验证公开 API 课程详情（含课时） ===")
r = requests.get(f"{BASE}/zhao-course/v1/courses?pagination[pageSize]=20&populate=*")
courses = r.json().get('data', [])
for c in courses:
    if c.get('title') in target_titles:
        lessons = c.get('lessons', [])
        tag_val = c.get('sequenceTag')
        tag_name = tag_val.get('name') if tag_val and isinstance(tag_val, dict) else tag_val
        print(f"  [{c.get('documentId','')[:12]}] {c.get('title')} | seqNum={c.get('sequenceNumber')} | enforce={c.get('enforceSequence')} | tag={tag_name} | retry={c.get('quizRetryCount')} | lessons={len(lessons) if lessons else 0}")
