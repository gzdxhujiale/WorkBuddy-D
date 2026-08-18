/**
 * Client-created UUIDs are named by domain so optimistic records keep an
 * explicit identity at their creation boundary. Values remain standard UUIDs
 * because they are persisted in UUID database columns and used as foreign keys.
 */
const createUuid = (): string => crypto.randomUUID();

export const createTaskId = createUuid;
export const createProjectId = createUuid;
export const createProjectStageId = createUuid;
export const createProjectTemplateId = createUuid;
export const createFocusSessionId = createUuid;
export const createFocusCycleId = createUuid;
export const createKnowledgeBaseId = createUuid;
export const createKnowledgeFolderId = createUuid;
export const createNoteGroupId = createUuid;
export const createNoteId = createUuid;
export const createHabitId = createUuid;
export const createDailyReviewId = createUuid;
