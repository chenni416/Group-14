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
    updateGoal: (id, goal) => data(http.patch(`/sprints/${id}`, { goal })),
    start: (id) => data(http.post(`/sprints/${id}/start`)),
    burndown: (id) => data(http.get(`/sprints/${id}/burndown`)),
  },
  tasks: {
    list: () => data(http.get('/tasks')),
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
