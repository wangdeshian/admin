# 行政流程個人雲端版

獨立 Firebase 專案 `admin-workflow-103c8`，Spark 免費方案，Firestore Standard（台灣 `asia-east1`）。原本 `/workflow/` 的瀏覽器資料與其他網站不變。

正式發布前在 Firebase Console 檢查 `firestore.rules`，只在 Console 由管理員維護 `adminWorkflowMembers` 授權文件，不把帳號或管理憑證放進 GitHub。新增或替換授權前先確認對象與用途。匯入原本的本機備份必須由使用者選擇，且匯入會取代雲端內容，不會自動搬移。
