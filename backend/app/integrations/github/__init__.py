"""GitHub 整合：以 GitHub App 讀取專案 repo。

- client.py：呼叫 GitHub API（App 認證、installation token、使用者授權、repo 清單）
- state.py：安裝流程的 state 參數（簽章，防止偽造或被用在別的專案）
- 商業邏輯在 app/services/github_link.py

webhook（PR 狀態即時同步）需要部署後的公開網址，之後加在 app/api/routes，並以 settings.github_webhook_secret 驗證簽章。
"""
