# Web脆弱性診断ツール
PROJECT_PORT=25100

OWASP Security Testing GuidelineおよびIPA「ウェブ健康診断仕様」に基づいたWebアプリケーション脆弱性診断ツールです。

## 主な特長

- １０分で経済産業省のウェブ脆弱性診断の結果がわかる
- ウェブ診断は無料
- スキャン後に即時にレポートを閲覧可能（簡易版）
- PDFでレポートのダウンロードも可能
- 詳細なレポートは有料プランで提供
- Etzhayyimなら「脆弱性の対策まで対応が可能」
- **コマンドライン (CLI) インターフェース**で簡単に脆弱性スキャンを実行可能 (Optional/Status TBC)

## 取引実績

当社の脆弱性診断サービスは、以下のような多様な組織で採用されています：

- **官公庁**: 厚生労働省などの政府機関
- **研究機関**: 理化学研究所などの科学技術研究機関
- **金融機関**: 大手銀行や金融サービス企業
- **医療機関**: 病院や医療情報システム

これらの実績により、高度なセキュリティが求められる組織にも安心してご利用いただけます。

## 診断実施の条件

無料診断を実施するためには以下の条件があります：

- 利用規約への同意が必要
- 認証に使用するドメインと診断対象のドメインが同一である必要がある
- スクリーニング審査で対象外と判断される場合があります

## プロジェクト構造

> NOTE: `cdn/wvme-svelte-web-g6zynpsf` に SvelteKit (SSG+CSR) 版の移行作業ブランチがあります。
> 現行README本文はNext.js前提の記述が残っているため、移行状況は `MIGRATION_STATUS.md` も参照してください。

このプロジェクトはCargoワークスペース内にNext.jsアプリケーション (`crates/nextjs`) を含みます。
バックエンドロジックは主にSupabaseとNext.js Server Actionsを利用して実装されています。
フロントエンドの状態管理はXStateとZustandで行われます。
詳細なフロントエンドアーキテクチャ、状態遷移、データスキーマは `crates/nextjs/nextjs.ssot` ファイルで定義されています。

### 主要ディレクトリ (`crates/nextjs`)

```
crates/nextjs/
├── app/                 # Next.js App Router (Pages, Layouts, API Routes)
│   ├── (public)/        # Publicly accessible pages
│   ├── (authorized)/    # Pages requiring authentication
│   ├── (admin)/         # Admin-only pages
│   └── api/             # API Route Handlers (e.g., webhooks)
├── components/          # Reusable UI components (incl. /ui, /designsystem)
├── lib/                 # Core logic, utilities, types, constants
│   ├── machines/        # XState state machine definitions (from SSOT)
│   ├── server/          # Server-side logic helpers
│   │   └── actions/     # Next.js Server Actions
│   ├── supabase/        # Supabase client setup (@supabase/ssr)
│   ├── types/           # Shared TypeScript types
│   ├── validations/     # Zod validation schemas
│   └── utils.ts         # Utility functions
├── db/                  # Drizzle ORM schema definitions
│   └── schema/          # Table definitions
├── public/              # Static assets
├── supabase/            # Supabase CLI config and migrations (separate from lib/supabase)
├── tests/               # Frontend specific tests (Vitest, Playwright)
├── .env.local.example   # Environment variable template
├── next.config.mjs      # Next.js configuration
└── package.json         # Node.js dependencies
```

### オプション: Rust Scanner (`crates/scanner`)
- Rust製の脆弱性スキャンコアロジック/CLIツールも存在しますが、現在のNext.jsアプリケーションとの連携状況や保守ステータスは確認中です (Status TBC)。

## 機能

このツールは以下の脆弱性を診断できます：
- クロスサイトスクリプティング (XSS)
- SQLインジェクション
- コマンドインジェクション
- パストラバーサル
- XXE (XML外部実体) インジェクション
- クロスサイトリクエストフォージェリ (CSRF)
- オープンリダイレクト
- サーバーサイドリクエストフォージェリ (SSRF)
- その他、OWASPトップ10の脆弱性

## インストールと実行 (`crates/nextjs` アプリケーション)

### 前提条件

- Node.js (>= Version specified in `crates/nextjs/package.json`)
- pnpm (推奨) または npm
- Supabase CLI (for local development/migrations)
- Docker (for Supabase local dev environment)

### ローカル開発環境セットアップ

```bash
# プロジェクトルートに移動
# cd <project_root>

# Supabaseローカル環境起動 (初回 or 必要時)
supabase start

# Next.jsアプリケーションディレクトリへ移動
cd crates/nextjs

# .env.local ファイルに必要な環境変数を設定 (Supabase URL/Keyなど)
# crates/nextjs/.env.local.example をコピーして編集
# ローカル環境の場合、 `supabase start` で表示される URL と anon key を使用
cp .env.local.example .env.local
# (Edit .env.local with your keys)

# 依存関係インストール
pnpm install

# 開発サーバー起動
pnpm dev
```

### データベースマイグレーション
- Supabaseのマイグレーションは `supabase/migrations` ディレクトリで管理されます。
- ローカル環境には `supabase start` 時に自動適用されます。
- 本番環境への適用は Supabase のダッシュボードまたはCI/CDパイプライン経由で行います。

```bash
# (Optional) 新しいマイグレーション作成 (プロジェクトルートで実行)
# supabase migration new <migration_name>

# (Optional) ローカルDBリセット & マイグレーション再適用 (プロジェクトルートで実行)
# supabase db reset
```

## 開発ステータスとロードマップ (2024-07-26)

### 現状評価
- **バックエンド (Server Actions, Supabase Integration):** 安定稼働中。主要なスキャンロジック、非同期処理、データベース連携は実装済み (Est. 85-95% Complete)。RLSも実装済み。
- **フロントエンド (UI/UX, State Machines):** 開発中。コアとなるXStateマシン (`rootMachine`, `scanMachine` など) の定義はSSOTに基づき進行中。UIコンポーネント (Shadcnベース) と認証フロー、ダッシュボード、レポート表示などの主要画面は実装が必要 (Est. 60-80% Complete depending on component)。
- **テスト:** 拡充中。基本的なユニットテストや一部のBDDシナリオは存在しますが、包括的なカバレッジ（特にUI/E2E、状態遷移）は今後の課題です。
- **ドキュメント:** `crates/nextjs/nextjs.ssot` がフロントエンドの設計定義。このREADMEはプロジェクト全体の概要を提供。

### 主な技術スタック
- **Frontend:** Next.js (App Router v15.x), React 18.2.x, Tailwind CSS 3.3.x, Zustand 4.3.x, XState 5.x, Shadcn/ui, react-hook-form 7.43.x
- **Backend:** Next.js (Server Actions), Supabase (Auth, DB, Storage - via @supabase/ssr v2.x)
- **Database:** PostgreSQL (via Supabase), Drizzle ORM
- **Validation:** Zod
- **Testing:** Playwright (E2E), Vitest (Unit/Integration), @xstate/test
- **Deployment:** Vercel

### 短期目標 (Short-Term Goals)
1.  **UI実装:** ダッシュボード (`/dashboard`) および認証フロー (`/auth`) の主要なUI/UXをSSOTに基づき実装完了。
2.  **テスト拡充:**
    *   現状のテストスイート (`pnpm test`, `playwright test`) を実行し、カバレッジとBDD準拠状況を正確に把握。
    *   `userSettingsMachine`, `accountMachine` 等の未実装・開発中機能に対する状態遷移テスト (`@xstate/test`) を追加。
    *   主要なユーザーストーリーに対するE2Eテスト (`playwright`) を追加。
3.  **`crates/scanner` 状況確認:** CLIツールの現状 (機能、連携、保守) を確認し、READMEに反映または別ドキュメント化。
4.  **SSOT同期:** 実装と `crates/nextjs/nextjs.ssot` の定義に乖離がないか確認・修正。

### 中期目標 (Medium-Term Goals)
1.  **レポート機能:** レポート生成機能 (`/reports`?) のUIとロジックを完成させ、レビューを実施。
2.  **課金機能:** 有償プラン管理機能 (Stripe連携、プラン選択UIなど) を実装。
3.  **通知機能:** Eメール通知システム (スキャン完了、アカウント関連など) を実装。
4.  **パフォーマンス:** フロントエンドおよびバックエンドのパフォーマンスボトルネック特定とチューニング。
5.  **RBAC:** アカウント管理機能におけるロールベースアクセス制御を実装・テスト。

### 長期目標 (Long-Term Goals)
1.  **AI機能:** AI分析機能 (脆弱性パターンの高度分析、レポーティング補助など) の導入検討・実装。
2.  **脆弱性DB:** 診断可能な脆弱性パターンの継続的な追加・更新。
3.  **インフラ最適化:** 本番環境向けインフラ構成 (Supabase/Vercel) の最終決定と最適化。
4.  **セキュリティ監査:** 包括的なセキュリティ監査の実施。

### BDDテスト適用状況 (要実行確認)
BDDアプローチに基づきテストを実装・拡充中ですが、実際のカバレッジと結果はテスト実行により確認が必要です。
- **脆弱性スキャン機能**: 基本的なスキャン実行、結果取得など (実装中)
- **UIテスト**: 主要フォーム、結果表示、エラーハンドリングなど (実装中)
- **API/Actionセキュリティ**: 入力検証、認証、インジェクション対策など (実装中)
- **認証・認可**: ログイン、登録、アクセス制御など (実装中)

### セキュリティ対策状況
- JWT認証 (Supabase Auth)
- HTTPSエンドポイント (Vercel)
- CORS設定 (Next.js / Vercel)
- 入力バリデーション (Zod)
- 権限管理システム (Supabase RLS, アプリケーションレベルRBAC - 実装中)

## ライセンス

All rights reserved by the author.
