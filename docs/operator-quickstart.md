# app-wvme — operator quickstart

このリポジトリを初めて触る人が、**手元で何が動き、何が動かないか**を 15 分で
確かめるための手順。ここに書いてある手順は全部、書いた人が実際に踏んで
結果を書き写している。**踏めなかった手順は「動く」と書かず、落ちた理由を
そのまま載せている。**

- 実測日: 2026-08-29
- 実測時の tip: `335ba320ce3549a2c2e656c71940d75d79c8f5ec`
- 実測環境: node v26.7.0 / npm 11.19.0 / openjdk 24.0.2 / Clojure CLI 1.12.5.1654 (darwin arm64)

> ⚠ **このリポジトリは仕様と appview の入口だけを持つ。** README が挙げる
> スキャナ本体（`scanner` / `zaproxy` / `browserless-rs`）はここには無い。
> 何が在って何が無いかは [README.md](../README.md) の「このリポジトリの実体」を見る。

## 0. 全体像 — 触れるものは 2 つ

```
appview/wvme-mcp-component/
├── src/app.ts          Cloudflare Worker（8 XRPC メソッドを dispatcher へ中継）
│   └── test/           vitest
└── cljs/               reagent + re-frame + jp-go-dds の SPA
    ├── src/wvme/app.cljs
    └── test/wvme/      shadow-cljs :node-test
```

Worker は自分で診断をしない。`/xrpc/com.etzhayyim.apps.wvme.*` を
`DISPATCHER_URL`（既定 `https://dispatcher.etzhayyim.com`）へ中継するだけの
薄い edge である。SPA は `wrangler.jsonc` の `assets.directory`
(`./cljs/public`) から静的配信される。

## 1. SPA — 依存取得・ビルド・テスト（動く）

```bash
cd appview/wvme-mcp-component/cljs
npm ci
```
→ exit 0。

```bash
# ⚠ ビルドは repo-wide の resource governor を通す（CLAUDE.md）。直接叩かない。
node <superproject>/scripts/resource-guard.mjs run build -- npm run build
```
→ exit 0。`[:app] Build completed. (111 files, 110 compiled, 0 warnings, 58.75s)`。
出力は `public/js/`（`.gitignore` 済み。コミットしない）。

```bash
node <superproject>/scripts/resource-guard.mjs run build -- npm test
```
→ exit 0。`Ran 5 tests containing 22 assertions. 0 failures, 0 errors.`

`re-frame: Subscribe was called outside of a reactive context.` が何度も出るが、
これは警告で、終了コードには影響しない。

## 2. Worker — 依存取得とテスト（動く。ただし中身は空）

```bash
cd appview/wvme-mcp-component
npm ci && npm test
```
→ exit 0。`Test Files 1 passed (1) / Tests 1 passed (1)`。

⚠ **この 1 本は `expect(true).toBe(true)` である。** `src/app.ts` の不変条件
（`/xrpc/` の NSID prefix ゲート、壊れた JSON → 400、クエリと body の
マージ順、secret binding と生文字列の出し分け、既定 404、`/health` の
ペイロード）は **1 つも検査されていない**。緑は「壊れていない」ではなく
「何も見ていない」を意味する。

## 3. 動かない手順 2 つ（実測。回避策はまだ無い）

### 3a. `npm run typecheck` は落ちる — `tsconfig.json` が無い

```bash
cd appview/wvme-mcp-component && npm run typecheck
```
→ **exit 1。** `tsc` がコンパイルに失敗するのではなく、設定ファイルが無いので
ヘルプ本文を出して終わる。リポジトリに `tsconfig.json` は 1 つも無い
(`git ls-files | grep tsconfig` が 0 件)。**この repo の TypeScript は
一度も型検査されたことがない。**

### 3b. `wrangler deploy` は落ちる — `wrangler.jsonc` に `main` が無い

```bash
cd appview/wvme-mcp-component && npx wrangler deploy --dry-run --outdir /tmp/out
```
→ **exit 1**（wrangler 4.127.1）:

```
✘ [ERROR] Cannot use assets with a binding in an assets-only Worker.
  Please remove the asset binding from your configuration file,
  or provide a Worker script in your configuration file (`main`).
```

**原因は特定済み**（両方向を実測した）: `wrangler.jsonc` が `main` を宣言して
いないので wrangler は assets-only Worker と解釈し、そこに `ASSETS` binding が
在るのは矛盾なので拒否する。**`src/app.ts` はデプロイ設定から一度も参照されて
いない。**

検証: 設定のコピーに `"main": "src/app.ts"` を 1 行足すと同じコマンドが
**exit 0** になり、`Total Upload: 24.48 KiB / gzip: 6.19 KiB` と
`env.ASSETS` を含む binding 一覧を出す。**この 1 フィールドだけが原因。**

> この修正は**まだ当てていない**。`wrangler.jsonc` の `routes` は本番ゾーン
> `etzhayyim.com` を指しており、デプロイは fast-forward 検査を持たない
> （最後に実行した人が勝つ）。設定変更は独立した判断として扱う。

## 4. 宣言されている外部ホストは 4 つとも存在しない（実測）

`wrangler.jsonc` の `routes` と `src/app.ts` の既定値が指す先を DNS で引いた。

| ホスト | 出所 | 1.1.1.1 | 8.8.8.8 |
|---|---|---|---|
| `wvme.etzhayyim.com` | `routes` / `PROJECT.jsonld` | NXDOMAIN | NXDOMAIN |
| `vyie6ivw.etzhayyim.com` | `routes` | NXDOMAIN | NXDOMAIN |
| `dispatcher.etzhayyim.com` | `src/app.ts` の `DISPATCHER_URL` 既定 | NXDOMAIN | NXDOMAIN |
| `mcp.etzhayyim.com` | `AGENTGATEWAY_MCP_ROUTER_URL` | NXDOMAIN | NXDOMAIN |
| `etzhayyim.com`（対照） | ゾーン頂点 | NOERROR | NOERROR |

対照のゾーン頂点が引けているので、これは**測れなかった**のではなく
**測って無かった**。つまりこの appview は**デプロイされておらず、中継先の
dispatcher も存在しない**。3b を直してデプロイしても、Worker は存在しない
ホストへ中継することになる。

## 5. 次に触るなら（実測に基づく優先順）

1. **`test/wvme.test.ts` の置き換え** — §2 のとおり現状は劇場。`src/app.ts` は
   fetch ハンドラ 1 本なので、`Request` を組んで戻り値を見るだけで検査できる。
2. **`tsconfig.json` の追加** — §3a。`typecheck` script は既に `package.json` に在る。
3. **`wrangler.jsonc` に `main`** — §3b。修正内容は確認済みだが、本番ルートを
   持つので独立した判断で当てる。
4. **dispatcher の所在確認** — §4。無いものへ中継する設計のまま進めない。

## 6. 検査の在り処

- SPA のテスト: `appview/wvme-mcp-component/cljs/test/wvme/app_test.cljs`
- Worker のテスト: `appview/wvme-mcp-component/test/wvme.test.ts`（プレースホルダ）
- どちらも **fleet の成熟度スキャナには数えられていない**。スキャナが `test/` を
  数えるのはリポジトリ直下と、`deps.edn` を持つ第 1 階層のディレクトリ配下だけで、
  ここの `deps.edn` は第 3 階層 (`appview/wvme-mcp-component/cljs/`) に在るため。
  テストが無いのではなく、見えていない。
