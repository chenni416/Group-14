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
    end: (id) => data(http.post(`/sprints/${id}/end`)),
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
    accept: (id) => data(http.post(`/tasks/${id}/accept`)),
    negotiate: (id, input) => data(http.post(`/tasks/${id}/negotiate`, input)),
    claimReview: (id) => data(http.post(`/tasks/${id}/review/claim`)),
    startDevelopment: (id) => data(http.post(`/tasks/${id}/start`)),
    submitForReview: (id, delivery) => data(http.post(`/tasks/${id}/review`, delivery)),
    approveReview: (id, items) => data(http.post(`/tasks/${id}/review/approve`, { items })),
    requestChanges: (id, note, items) => data(http.post(`/tasks/${id}/review/request-changes`, { note, items })),
    confirmPlan: (id, status, note) => data(http.post(`/tasks/${id}/plan-confirm`, { status, note })),
    updatePolicy: (id, policy) => data(http.put(`/tasks/${id}/policy`, policy)),
  },
  planning: {
    getSampleMinutes: () => data(http.get('/planning/minutes/sample')),
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
  execution: {
    list: () => data(http.get('/execution-plans')),
    get: (taskId) => data(http.get(`/tasks/${taskId}/execution-plan`)),
    suggest: (taskId) => data(http.post(`/tasks/${taskId}/execution-plan/suggest`)),
    save: (taskId, input) => data(http.put(`/tasks/${taskId}/execution-plan`, input)),
    confirm: (taskId) => data(http.post(`/tasks/${taskId}/execution-plan/confirm`)),
    toggleItem: (taskId, itemId) => data(http.post(`/tasks/${taskId}/execution-plan/items/${itemId}/toggle`)),
    toggleCheckpoint: (taskId, checkpointId) => data(http.post(`/tasks/${taskId}/execution-plan/checkpoints/${checkpointId}/toggle`)),
  },
  issues: {
    list: () => data(http.get('/issues')),
    report: (input) => data(http.post('/issues', input)),
    assign: (id, ownerId) => data(http.post(`/issues/${id}/assign`, { ownerId })),
    respond: (id, text) => data(http.post(`/issues/${id}/respond`, { text })),
    resolve: (id) => data(http.post(`/issues/${id}/resolve`)),
    replan: (id) => data(http.post(`/issues/${id}/replan`)),
  },
  proposals: {
    list: () => data(http.get('/proposals')),
    create: (input) => data(http.post('/proposals', input)),
    comment: (id, text) => data(http.post(`/proposals/${id}/comments`, { text })),
    decide: (id, input) => data(http.post(`/proposals/${id}/decide`, input)),
  },
  acceptance: {
    check: (taskId) => data(http.post(`/tasks/${taskId}/acceptance/check`)),
    records: (taskId) => data(http.get(`/tasks/${taskId}/acceptance/records`)),
  },
  retros: {
    get: (sprintId) => data(http.get(`/sprints/${sprintId}/retro`)),
    list: () => data(http.get('/retros')),
    submitEntry: (sprintId, input) => data(http.post(`/sprints/${sprintId}/retro/entries`, input)),
    addAction: (sprintId, input) => data(http.post(`/sprints/${sprintId}/retro/actions`, input)),
    toggleAction: (sprintId, actionId) => data(http.post(`/sprints/${sprintId}/retro/actions/${actionId}/toggle`)),
    close: (sprintId) => data(http.post(`/sprints/${sprintId}/retro/close`)),
  },
};
