/* =========================================================
   進入點：頁面對應表 + 初始化（必須最後載入）
   新增頁面時：在 views/ 新增檔案，並在這裡註冊
   ========================================================= */
const VIEW={dashboard:vDashboard,team:vTeam,onboard:vOnboard,planning:vPlanning,inbox:vInbox,board:vBoard};
seed();render();
