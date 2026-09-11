# WVME — Web脆弱性診断ツール

OWASP Security Testing Guideline および IPA「ウェブ健康診断仕様」に基づいた
Webアプリケーション脆弱性診断サービスの、**仕様と appview（入口）を持つ
リポジトリ**。

- **はじめて触る人は [`docs/operator-quickstart.md`](docs/operator-quickstart.md) から。**
  何が動き、何が動かないかを実測済みで書いてある。

## このリポジトリの実体（2026-08-29 実測）

**⚠ ここにスキャナ本体は無い。** このリポジトリが持つのは (1) 診断仕様と
(2) appview の edge 層だけで、実際に診断を行うサービス（`scanner` /
`zaproxy` / `browserless-rs`）は別の場所に在る。追跡ファイルは 30 件:

> **ZAP 相当の DAST 判定核は 2026-09-06 に着地した:**
> [`kotoba-lang/zap-proxy`](https://github.com/kotoba-lang/zap-proxy)
>（superproject `orgs/kotoba-lang/zap-proxy`、ADR-2609060001）。spider /
> passive / active / report の pure 判定核 + CLI。本リポジトリの dispatcher
> からの呼び出し経路（`DISPATCHER_URL` 先の scanner orchestration）は未着手。

| 何 | どこ | 中身 |
|---|---|---|
| **診断仕様** | `SPEC.tsv` | IPA/OWASP に対応する診断項目 125 行（大分類・中分類・診断方法） |
| **プロセス定義** | `bpmn/wvme.bpmn` | 診断フローの BPMN |
| **構想・設計** | `STORY.md` | 想定するマイクロサービス構成とワークフロー |
| **Worker** | `appview/wvme-mcp-component/src/app.ts` | 8 メソッドを dispatcher へ中継する薄い edge |
| **SPA** | `appview/wvme-mcp-component/cljs/` | reagent + re-frame + jp-go-dds |
| **メタデータ** | `PROJECT.jsonld` / `README.edn` / `OWNERS` | 機械可読な自己記述 |
| **移行記録** | `MIGRATION_STATUS.md` / `MIGRATION-TODO.md` / `migration.edn` / `ToDo.md` | 過去の移行作業の残り |

> **この README は 2026-08-29 に書き直した。** それ以前の版は `crates/nextjs`
> (Next.js App Router)・`crates/scanner` (Rust)・Supabase・Drizzle ORM・
> XState・Cargo ワークスペース・Vercel デプロイを前提に書かれていたが、
> **それらはこのリポジトリに 1 ファイルも存在しない**（`git ls-tree -r main`
> に対して `crates/` `supabase/` `next.config` `db/schema` いずれも 0 件）。
> 旧版の「バックエンドは安定稼働中 (85-95% Complete)」という記述も、対応する
> コードがここに無いため裏付けが取れない。実装の現在地は
> `docs/operator-quickstart.md` を正とする。

## 検査の構成（3 つの suite が、3 つの別のものを見る）

```
run_tests.cljk            リポジトリ横断の自己記述の一貫性（nbb + cljs.test）
└── test/wvme/repo_test.cljk   7 ファイルに写された identity を突き合わせる

appview/wvme-mcp-component/
├── src/app.ts          Cloudflare Worker（edge dispatcher）
├── test/wvme.test.ts   vitest — Worker の routing / error shape / 転送規則
├── wrangler.jsonc      ルート・vars・assets 設定
└── cljs/               SPA（shadow-cljs）
    ├── src/wvme/app.cljs
    └── test/wvme/app_test.cljs   re-frame の event / sub
```

**ルートの suite が在るのは、identity がどのサブパッケージにも属さないから。**
DID・nanoid・公開ルート・8 メソッド・var 名は 7 つのファイルに手で写されて
おり、Worker の vitest から `PROJECT.jsonld` は見えず、cljs の suite から
`wrangler.jsonc` は見えない。ファイルとファイルの**間**を見る場所が、ここまで
1 つも無かった。

Worker 自身は診断ロジックを持たない。`/xrpc/com.etzhayyim.apps.wvme.*` を
`DISPATCHER_URL` へ中継し、それ以外は 404 を返す。公開する 8 メソッド:

```
createScan / listScans / getScan / listVulnerabilities
getVulnerability / createRemediation / listRemediations / getScanReport
```

フロントエンドは 2026-08 に Svelte から ClojureScript
（reagent + re-frame + jp-go-dds）へ移行済み。これはワークスペース既定の
UI スタック（ADR-2608260900 / ADR-2608080100 の single-page app 規則）に従う。

## 動かし方

`docs/operator-quickstart.md` に実測済みの手順がある。要点だけ:

```bash
# SPA（ビルドは必ず resource governor 経由。CLAUDE.md）
cd appview/wvme-mcp-component/cljs && npm ci
node <superproject>/scripts/resource-guard.mjs run build -- npm run build
node <superproject>/scripts/resource-guard.mjs run build -- npm test

# Worker
cd appview/wvme-mcp-component && npm ci && npm test

# リポジトリ横断の自己記述検査（依存も network も要らない）
nbb --classpath test run_tests.cljk
```

**既知の欠陥（実測、未修正）** — 詳細と原因の切り分けは quickstart の §3〜§4:

1. `npm run typecheck` は落ちる（`tsconfig.json` が無い）
2. `wrangler deploy` は落ちる（`wrangler.jsonc` に `main` が無く、`src/app.ts`
   がデプロイ設定から参照されていない）
3. `wvme.etzhayyim.com` / `vyie6ivw.etzhayyim.com` / `dispatcher.etzhayyim.com` /
   `mcp.etzhayyim.com` は **4 つとも DNS に存在しない**（ゾーン頂点
   `etzhayyim.com` は解決するので、これは未測定ではなく不在）
4. `PROJECT.jsonld` の `component` は、このリポジトリに無い 3 サービス
   （NestJS backend の `wvme`、Next.js の `wvme-web` / `wvme-admin`）を挙げた
   ままである。旧 README と同じ齟齬で、まだ直っていない

> **旧 4 番目「`test/wvme.test.ts` は `expect(true).toBe(true)` — 落ちようがない」は
> 2026-09-02 に解消した。** 16 本の実テストに置き換え、`src/app.ts` を 9 通りに
> 壊して 9 通りとも赤くなることを確認している（落ちるところを見ていない検査は劇場、
> という `scripts/maturity-loop` の考え方）。

## 診断できる脆弱性（仕様上）

`SPEC.tsv` が正本。大きくは OWASP Top 10 に対応する:

- インジェクション（SQL / コマンド / XXE）
- クロスサイトスクリプティング (XSS)
- パストラバーサル
- クロスサイトリクエストフォージェリ (CSRF)
- オープンリダイレクト
- サーバーサイドリクエストフォージェリ (SSRF)

## サービスとしての特長

- 10 分で経済産業省のウェブ脆弱性診断の結果がわかる
- ウェブ診断は無料
- スキャン後に即時にレポートを閲覧可能（簡易版）
- PDF でレポートのダウンロードも可能
- 詳細なレポートは有料プランで提供
- Etzhayyim なら「脆弱性の対策まで対応が可能」

### 診断実施の条件

- 利用規約への同意が必要
- 認証に使用するドメインと診断対象のドメインが同一である必要がある
- スクリーニング審査で対象外と判断される場合があります

### 取引実績

当社の脆弱性診断サービスは、官公庁（厚生労働省などの政府機関）、研究機関
（理化学研究所などの科学技術研究機関）、金融機関、医療機関で採用されています。

## ライセンス

All rights reserved by the author. `LISENCE.md` / `NOTICE` を参照。
