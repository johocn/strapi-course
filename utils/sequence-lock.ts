const RETRY_MAP = {
  no_retry: 0,
  retry_1: 1,
  retry_2: 2,
  retry_3: 3,
  retry_4: 4
};
function checkItemLock(target, allItems) {
  if (!target.sequenceTag || target.sequenceNumber === 0) {
    return { locked: false, enforceMode: false, reason: "" };
  }
  const prerequisites = allItems.filter(
    (item) => item.sequenceTag?.documentId === target.sequenceTag?.documentId && item.sequenceNumber > 0 && item.sequenceNumber < target.sequenceNumber
  );
  prerequisites.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const firstIncomplete = prerequisites.find((item) => !item.isCompleted);
  if (firstIncomplete) {
    return {
      locked: true,
      enforceMode: target.enforceSequence,
      reason: `\u8BF7\u5148\u5B8C\u6210\uFF1A${firstIncomplete.title}`,
      firstIncomplete
    };
  }
  return { locked: false, enforceMode: false, reason: "" };
}
function isCourseCompleted(lessons) {
  const requiredLessons = lessons.filter((l) => l.isRequired !== false);
  if (requiredLessons.length === 0)
    return true;
  return requiredLessons.every((l) => l.isCompleted);
}
function isQuizButtonLocked(allowRetakeQuiz, isPointsClaimed, earnedLessonIds, lessonDocumentId) {
  if (allowRetakeQuiz)
    return false;
  return isPointsClaimed || earnedLessonIds.has(lessonDocumentId);
}
export {
  RETRY_MAP,
  checkItemLock,
  isCourseCompleted,
  isQuizButtonLocked
};
