# リミーAI診断（onboarding-diagnosis）— CLAUDE.md

## ⚠️ プロジェクト境界（最重要・2026-06-03追加）

### このディレクトリで扱う事業
**リミーAI診断のみ**（入社90日サポート診断システム・本業）

### 他事業の話が出てきたら
1. 「これは別プロジェクトの話ですね」と認識を示す
2. メモリ `cross_project_concerns.md` への追加を提案
3. **その場では作業を進めない**

### 「ついで修正」は禁止
- 「AI診断でこれを直したから、リミーPostでも同じことを…」と提案・着手しない
- 明示的に「今やる」と指示がない限り、AI診断の作業に専念する

### GAS編集チェックリスト
- 対象GASプロジェクトURL：`https://script.google.com/home/projects/1-eWdPRO5hqQ4X9K4a_1-3r-9WF4b7sNdIZX0gSC2-pBMHclQnubF7SoC/edit`
- ファイル名：`apps-script.gs`
- 編集前に必ず既存コードを Read してから差分提示
- デプロイは「**新しいバージョン**」を選ぶ（「新しいデプロイ」はNG・Web App URL変動）

---

## サービス概要

入社90日サポート診断システム。新入社員が25問回答 → AIがレポート生成 → 本人・マネージャー・管理者にメール送信。

- **公開URL**: https://shinomiho.github.io/onboarding-diagnosis/
- **GitHub**: https://github.com/shinomiho/onboarding-diagnosis
- **GAS Web App URL**: https://script.google.com/macros/s/AKfycbyGceshWFX-_kepVh5KHTvNwsrNAh7hW22U48KSp4DVvohXurOsAa6BDW7MFrsbKJ0n/exec

## 主要ファイル

| ファイル | 役割 |
|--------|------|
| index.html | 診断フォーム（25問） |
| result.html | 結果閲覧ページ（URLシェア用） |
| admin.html | 管理画面（会社登録・URL発行・回答閲覧・KPIダッシュボード） |
| register.html | 企業自己登録フォーム（トークン認証） |
| company-admin.html | 企業向け従業員管理画面 |
| guide.html | 企業向け導入ガイド |
| kpi.html | KPIダッシュボード |
| action-check.html | 管理者アクションチェックフォーム |
| apps-script.gs | GASバックエンド |

## 6因子＋アウトカム構造（2026-06-03再設計）
**インプット6因子（先行指標）**：
- A:業務負荷
- B:業務適応
- C:関係性の共有度
- D:関係性の心理的安全性
- E:自己調整感
- F:行動の変化（独自指標）

**アウトカム1因子（結果指標）**：
- G:継続定着意思

リスク判定閾値：E・F・G のいずれかが 2.5未満で要介入アラート。

## スプレッドシート
- companies / employees / responses / monthly_reports / manager_actions

## GASトリガー
- `sendMonthlyReports`：毎月1日・15日
- `sendActionCheckReminders`：毎日9時（5日・20日のみ動作）
- `backupAllSheets`：毎月1日 0〜1時

## Mihoさんの運用フロー
1. 企業へ `register.html?token=REME2026` を送る
2. 企業が自己登録 → URL自動発行＋ウェルカムメール
3. 企業に従業員管理画面URL（`company-admin.html?code=LIMEE_XXXXXX`）を渡す
4. 企業が従業員追加 → 招待メール自動送信
5. あとは全自動（診断・レポート・月次・リマインド・KPI蓄積）
