"""GitHub 整合（空殼）。

預計使用 GitHub App：Leader 將 App 安裝到專案 repo，PR 開啟、審查、合併時
GitHub 以 webhook 通知後端，後端再更新對應任務的 pr 欄位與狀態。
webhook 路由之後加在 app/api/routes，並以 settings.github_webhook_secret 驗證簽章。
"""
