# WVME Migration Status (Step-by-step)

最終更新: 2026-02-18

## スコープ
- Next.js (`cdn/wvme-web-g6zynpsf`) から SvelteKit SSG+CSR (`cdn/wvme-svelte-web-g6zynpsf`) への移行
- `https://etzhayyim.com/` 経由の Connect-gRPC 接続への移行

## 現在の評価 (Baseline)
- フロントエンド基盤移行 (Next.js → SvelteKit): **60-70%**
- Connect-gRPC 接続切替 (`etzhayyim.ai`): **40-55%**
- 全体: **50-60%**

## フェーズ計画

### Phase 1: 土台整備（進行中）
- [x] SvelteKit static adapter / fallback 設定
- [x] ルーティング雛形（stub）生成
- [x] Connect client をSvelte向け env 参照 (`import.meta.env.PUBLIC_*`) に正規化
- [ ] 接続先のデフォルトを `etzhayyim.ai` 系に統一
- [ ] README / Runbook の Svelte化（旧Next.js記述の更新）

### Phase 2: 機能移植（未着手〜進行中）
- [~] Public pages の実装移植（LP/preview/help/auth）
  - [x] `/demo` を stub から App connect-gRPC 実行画面へ移行
  - [x] `/scan/preview` を stub から App `captureScreenshot` 実行画面へ移行
- [~] Account pages の実装移植（summary/history/subscription/settings）
  - [x] `/account/scan/targets` を stub から一覧表示へ移行（Supabase依存を除去し、MCP endpoint経由へ切替）
  - [x] `/vulnerabilities` を stub から App `listAlerts` 閲覧画面へ移行
- [~] Account pages の実装移植（summary/history/subscription/settings）
  - [x] `/account/scan/targets` を stub から一覧表示へ移行（Supabase依存を除去し、MCP endpoint経由へ切替）
  - [x] `/account/summary` を stub から `getScanStatus` + `listAlerts` 集計画面へ移行
  - [x] `/account/history` を stub から MCP 履歴一覧画面へ移行
  - [x] `/account` を stub から MCP runner 画面へ移行
  - [x] `/account/settings` を stub から MCP runner 画面へ移行
  - [x] `/account/subscriptions` を stub から MCP runner 画面へ移行
  - [x] `/account/users` を stub から MCP runner 画面へ移行
  - [x] `/account/billing` を stub から MCP runner 画面へ移行
- [ ] Scan flows の実装移植（targets/sessions/reports）
- [ ] 旧Next.js API依存部分の置換（client-side + backend endpoint方針確定）

### Phase 3: 接続統合（未着手）
- [ ] `etzhayyim.ai` の Connect endpoint パス確定
- [ ] 環境変数命名統一（Next: `NEXT_PUBLIC_*` / Svelte: `PUBLIC_*`）
- [ ] pre-prod で CORS / auth / timeout / retry を検証

### Phase 4: 検証・切替（未着手）
- [ ] 主要画面のE2E整備
- [ ] 移行受け入れチェック（機能/性能/セキュリティ）
- [ ] 本番トラフィック切替
- [ ] Next.js側の段階的deprecate

## 次の一手（優先度順）
1. Svelte全ページの「stub」判定を収集し、実装移植対象を確定
2. Connect endpoint (`etzhayyim.ai`) の運用パスを確定
3. 重要ユースケース3本（scan preview / target list / report view）を先行移植


## Supabase除去の残作業スケジュール

- **Week 1 (即日〜5営業日):**
  - Svelte runtime の Supabase import 参照を全廃（`lib/api.ts` 依存ページを MCP client に置換）
  - `check-env.js` / `.env.example` を MCP 変数へ更新
  - `/account/*` 主要導線の API 呼び出し先を `[nanoid].etzhayyim.com/api/mcp` に統一
- **Week 2:**
  - Supabase CLI scripts と `supabase/` ディレクトリ依存を開発フローから除去
  - テスト（vitest/playwright）の Supabase 前提モックを MCP モックへ置換
  - `README` / runbook / onboarding の Supabase記述を完全撤去
- **Week 3:**
  - `package.json` から `@supabase/*` を削除
  - 残存 import の最終検査（`rg -n "supabase|@supabase"` が 0件になること）
  - pre-prod 環境で connect envoy gateway 経由疎通試験・負荷試験
- **Week 4 (cutover):**
  - 本番切替（Supabaseフラグ無効化）
  - 1週間モニタリング（エラー率, P95, スキャン成功率）
  - 旧 Supabase artifacts の削除
