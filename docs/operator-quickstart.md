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
> ZAP 相当の DAST 判定核は 2026-09-06 に `kotoba-lang/zap-proxy`
>（https://github.com/kotoba-lang/zap-proxy、ADR-2609060001）に着地した。
> dispatcher からの呼び出し経路は未着手。
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
→ exit 0。`[:app] Build completed. (111 files, 110 compiled, 0 warnings)`。
ファイル数と警告 0 は 2 回とも同じ値だった。**所要時間は書かない** —— このマシンは
並行 agent で load が大きく振れ、同じ tree の同じビルドが 58.75s と 42.15s だった。
出力は `public/js/`（`.gitignore` 済み。コミットしない）。

```bash
node <superproject>/scripts/resource-guard.mjs run build -- npm test
```
→ exit 0。`Ran 5 tests containing 22 assertions. 0 failures, 0 errors.`

`re-frame: Subscribe was called outside of a reactive context.` が何度も出るが、
これは警告で、終了コードには影響しない。

## 2. Worker — 依存取得とテスト（動く）

```bash
cd appview/wvme-mcp-component
npm ci && npm test
```
→ exit 0。`Test Files 1 passed (1) / Tests 16 passed (16)`（実測 2026-09-02）。

この 16 本が見ているのは `src/app.ts` の振る舞いだけ —— `/xrpc/` の NSID
prefix ゲート、壊れた JSON → 400、GET/POST 以外 → 404、クエリと body の
マージ順（body が勝つ）、secret binding と生文字列の出し分け、dispatcher の
status と body の素通し、`/health` のペイロード。

> **この 1 本は 2026-09-01 まで `expect(true).toBe(true)` だった。** vitest は
> 動き、緑を出し、`1 passed` と報告し続けたが、`src/app.ts` をどう壊しても
> 赤くならなかった。置き換えた 16 本は、`src/app.ts` を 9 通りに壊して
> **9 通りとも、名指しした test が赤くなること**を確認してある。

## 2.5 リポジトリ横断の自己記述検査（依存も network も要らない）

```bash
kbb --backend sci --classpath test run_tests.cljk
```
→ exit 0。`Ran 12 tests containing 41 assertions` → `app-wvme self-description: all green`
（実測 2026-09-02）。

identity（DID・nanoid・公開ルート・8 つの XRPC メソッド・var 名）は
**7 つのファイルに手で写されている**。この suite だけがその間を見る ——
`src/app.ts` / `wrangler.jsonc` / `kotodama.jsonld` / `cljs/src/wvme/app.cljs` /
`PROJECT.jsonld` / `README.md` / `README.edn`。12 本とも、対応する 1 箇所を
壊して赤くなるところを実際に見てある。

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

1. **`tsconfig.json` の追加** — §3a。`typecheck` script は既に `package.json` に在る。
2. **`wrangler.jsonc` に `main`** — §3b。修正内容は確認済みだが、本番ルートを
   持つので独立した判断で当てる。
3. **`PROJECT.jsonld` の `component`** — このリポジトリに無い 3 サービス
   （NestJS backend、Next.js の web / admin）を挙げたまま。旧 README と同じ齟齬で、
   §2.5 の suite が意図的に pin していない唯一の箇所（直っていないものを不変条件に
   すると、誤りを正しさとして固定してしまう）。
4. **dispatcher の所在確認** — §4。無いものへ中継する設計のまま進めない。

> **旧 1 番目「`test/wvme.test.ts` の置き換え」は 2026-09-02 に済んだ**（§2）。

## 6. 検査の在り処

- 横断（自己記述の一貫性）: `test/wvme/repo_test.cljk` — 走らせるのはルートの
  `run_tests.cljk`
- Worker: `appview/wvme-mcp-component/test/wvme.test.ts`
- SPA: `appview/wvme-mcp-component/cljs/test/wvme/app_test.cljk`

後ろの 2 つは **fleet の成熟度スキャナには数えられていない**。スキャナが `test/`
を数えるのはリポジトリ直下と、`deps.edn` を持つ第 1 階層のディレクトリ配下だけで、
ここの `deps.edn` は第 3 階層 (`appview/wvme-mcp-component/cljs/`) に在るため。
テストが無いのではなく、見えていない。ルートの suite はリポジトリ直下に在るので
数えられるが、**そこに置いたのは数えられるためではなく、見ている対象がリポジトリ
全体をまたぐから**である（どのサブパッケージからも、隣のファイルが見えない）。
