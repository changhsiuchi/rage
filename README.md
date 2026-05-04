# Rage Bait 計算風格學分析系統

基於 Chinese EmoBank（Lee et al., 2022）的瀏覽器端計算風格學分析工具。所有分析在使用者瀏覽器內完成，**資料不上傳任何伺服器**。

## ✨ 功能

- 🖋️ **資料蒐集**：表單輸入貼文 + 流量數據（按讚/留言/分享）
- 🔍 **自動分析**：斷詞 → 詞典比對 → V/A 計算 → Rage 詞辨識
- 📊 **統計報告**：Spearman 相關矩陣、V-A 散布圖、高/低流量對照
- 💾 **本機儲存**：localStorage 持久化，支援 CSV/JSON 匯出匯入
- 📚 **詞典查詢**：5,512 個詞彙 + 2,250 個片語可即時搜尋

## 🚀 部署到 GitHub Pages（5 分鐘）

### 方式 1：直接上傳

1. 在 GitHub 建立新 repository（例如 `rage-bait-analyzer`）
2. 把這三個檔案上傳到 repo 根目錄：
   - `index.html`
   - `app.js`
   - `emobank.json`
3. 進入 repo **Settings → Pages**
4. **Source** 選 `Deploy from a branch`，**Branch** 選 `main` / `(root)`
5. 等待 1-2 分鐘，網址會出現在 `https://<你的帳號>.github.io/rage-bait-analyzer/`

### 方式 2：使用 Git 命令列

```bash
git init
git add index.html app.js emobank.json README.md
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<你的帳號>/rage-bait-analyzer.git
git push -u origin main
```
然後到 Settings → Pages 啟用即可。

## 🖥️ 本地測試

因為瀏覽器安全限制，**不能直接打開 `index.html`**（fetch JSON 會被擋），需要起一個 local server：

```bash
# Python 3
cd rage_bait_app
python3 -m http.server 8000
# 打開 http://localhost:8000

# 或 Node.js
npx serve
```

## 📋 使用流程

1. 打開網站 → 在「資料蒐集」分頁填入貼文
2. 累積 5 篇以上 → 切到「分析報告」看相關係數
3. 累積 30+ 篇 → 結果開始有統計意義
4. 隨時點「匯出 CSV」備份（含完整分析欄位）

## 🤝 多人協作

由於資料儲存於本機瀏覽器，多人協作建議流程：

1. 組員 A 填好 50 筆 → 匯出 CSV
2. 組員 B 開啟網站 → 匯入 A 的 CSV → 繼續填寫
3. 全部彙整後 → 由負責人最後匯出做正式分析

## 📚 引用文獻

> Lee, L.-H., Li, J.-H., & Yu, L.-C. (2022). Chinese EmoBank: Building valence-arousal resources for dimensional sentiment analysis. *ACM Transactions on Asian and Low-Resource Language Information Processing*, *21*(4), Article 65. https://doi.org/10.1145/3489141

## ⚙️ 技術細節

- **斷詞**：最長匹配（greedy longest-match），最大長度 6 字
- **詞典**：CVAW（5,512 詞）+ CVAP（2,250 片語）合併
- **Rage 詞定義**：Valence < 3.5 ∧ Arousal > 6.5（530 個詞）
- **相關分析**：Spearman ρ + t 分配近似 p-value
- **無外部依賴**：純原生 HTML/CSS/JS，僅載入 Google Fonts
