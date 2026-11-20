"""商業邏輯層（尚未實作）。

路由（app/api/routes）只負責解析請求與回應，實際規則放在這裡，方便測試與重用。
前端 mock 的規則可以直接當成規格移植，對照表見 docs/api.md：
- 派工、帶入／延後、協商、審查路由：frontend/src/services/mock/tasks.ts
- 執行計畫、問題、提案、留言、驗收、回顧：frontend/src/services/mock/collab.ts
- 超載檢查、相依排序、指派建議等純函式：frontend/src/lib/planning.ts、frontend/src/mocks/handlers/
"""
