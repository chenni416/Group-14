import type { Services } from '../contracts';
import { data, http } from './client';

/**
 * 真實後端實作。端點為預留的 REST 設計，串接時依後端 OpenAPI 調整即可，
 * UI 元件不需要修改。
 */
export const httpServices: Services = {
  auth: {
    me: () => data(http.get('/me')),
    switchUser: (memberId) => data(http.post('/auth/switch', { memberId })),
  },
  members: {
    list: () => data(http.get('/members')),
    invite: (input) => data(http.post('/members', input)),
    update: (id, patch) => data(http.patch(`/members/${id}`, patch)),
  },
  workspace: {
    getOrganization: () => data(http.get('/organization')),
    getProject: () => data(http.get('/project')),
    updateProject: (patch) => data(http.patch('/project', patch)),
  },
  docs: {
    list: () => data(http.get('/docs')),
    upload: (files) => data(http.post('/docs', { files })),
    addLink: (url) => data(http.post('/docs/links', { url })),
    remove: (id) => data(http.delete(`/docs/${id}`)),
    search: (query) => data(http.get('/docs/search', { params: { q: query } })),
  },
  sprints: {
    list: () => data(http.get('/sprints')),
    defaults: () => data(http.get('/sprints/defaults')),
    create: (input) => data(http.post('/sprints', input)),
    update: (id, patch) => data(http.patch(`/sprints/${id}`, patch)),
    addDocs: (id, files) => data(http.post(`/sprints/${id}/docs`, { files })),
    analyze: (id, minutes) => data(http.post(`/sprints/${id}/analyze`, { minutes })),
    answer: (id, questionId, answer) => data(http.put(`/sprints/${id}/questions/${questionId}`, { answer })),
    start: (id) => data(http.post(`/sprints/${id}/start`)),
    burndown: (id) => data(http.get(`/sprints/${id}/burndown`)),
    backlog: () => data(http.get('/backlog')),
    removeBacklog: (id) => data(http.delete(`/backlog/${id}`)),
    dependencies: (id) => data(http.get(`/sprints/${id}/dependencies`)),
  },
  tasks: {
    list: () => data(http.get('/tasks')),
    create: (input) => data(http.post('/tasks', input)),
    update: (id, patch) => data(http.patch(`/tasks/${id}`, patch)),
    remove: (id) => data(http.delete(`/tasks/${id}`)),
    approveDrafts: () => data(http.post('/tasks/drafts/approve')),
    defer: (id) => data(http.post(`/tasks/${id}/defer`)),
    restore: (id) => data(http.post(`/tasks/${id}/restore`)),
    setCarry: (id, carry) => data(http.put(`/tasks/${id}/carry`, { carry })),
    resend: (id) => data(http.post(`/tasks/${id}/resend`)),
    suggestAssignee: (id) => data(http.post(`/tasks/${id}/suggest-assignee`)),
    resetReturn: (id) => data(http.post(`/tasks/${id}/reset-return`)),
    revise: (id, input) => data(http.put(`/tasks/${id}/revise`, input)),
    accept: (id) => data(http.post(`/tasks/${id}/accept`)),
    negotiate: (id, input) => data(http.post(`/tasks/${id}/negotiate`, input)),
    claimReview: (id) => data(http.post(`/tasks/${id}/review/claim`)),
    startDevelopment: (id) => data(http.post(`/tasks/${id}/start`)),
    submitForReview: (id) => data(http.post(`/tasks/${id}/review`)),
    approveReview: (id) => data(http.post(`/tasks/${id}/review/approve`)),
    requestChanges: (id, note) => data(http.post(`/tasks/${id}/review/request-changes`, { note })),
    updatePolicy: (id, policy) => data(http.put(`/tasks/${id}/policy`, policy)),
  },
  planning: {
    getMinutes: () => data(http.get('/planning/minutes')),
    getSampleMinutes: () => data(http.get('/planning/minutes/sample')),
    generateDraft: (input) => data(http.post('/planning/drafts', input)),
    generateTasks: (input) => data(http.post('/planning/drafts/tasks', input)),
    submitPlan: (draft) => data(http.post('/planning/drafts/submit', draft)),
    askStoryAssistant: (question, storyTitle) => data(http.post('/planning/drafts/chat', { question, storyTitle })),
    decompose: (sprintId) => data(http.post(`/sprints/${sprintId}/decompose`)),
    deferSuggested: (sprintId) => data(http.post(`/sprints/${sprintId}/defer-suggested`)),
    rebalance: (sprintId) => data(http.post(`/sprints/${sprintId}/rebalance`)),
  },
  notifications: {
    list: () => data(http.get('/notifications')),
  },
  studio: {
    getPrompt: (taskId) => data(http.get(`/tasks/${taskId}/prompt`)),
    setPromptVersion: (taskId, version) => data(http.put(`/tasks/${taskId}/prompt/current`, { version })),
    getChat: (taskId) => data(http.get(`/tasks/${taskId}/chat`)),
    ask: (taskId, question) => data(http.post(`/tasks/${taskId}/chat`, { question })),
  },
};
