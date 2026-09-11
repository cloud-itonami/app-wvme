// wvme edge Worker — src/app.ts の振る舞い。
//
// ## これは何を置き換えたか
//
// 2026-09-01 まで、このファイルの中身は次の 5 行だった:
//
//     describe("wvme actor", () => {
//       it("has placeholder test", () => { expect(true).toBe(true); });
//     });
//
// vitest は動き、緑を出し、CI は 1 passed と報告し続けた。**しかし
// src/app.ts をどう壊しても、このファイルは赤くならなかった** —— README は
// これを既知の欠陥 4 として「落ちようがない」と記録している。
// superproject CLAUDE.md の言葉では「落ちない gate は劇場」。
//
// ## ここが見るもの / 見ないもの
//
// Worker 1 つの振る舞いだけを見る:  routing・error shape・body と query の
// 合流規則・dispatcher への転送。
//
// **identity（DID / nanoid / 8 メソッド / routes）が他のファイルと一致するかは
// ここでは見ない** —— それは repo のルートの `run_tests.cljk` が持つ。
// ここから PROJECT.jsonld も cljs/src も見えないので、見えるふりをしない。

import { describe, it, expect, vi, afterEach } from "vitest";
import worker from "../src/app";

type Env = Record<string, unknown>;

/** 呼ばれた fetch を記録して、決め打ちの応答を返す。 */
function stubFetch(status = 200, body = '{"ok":true}') {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status });
  });
  return calls;
}

const NSID = "com.etzhayyim.apps.wvme.listScans";
const get = (path: string) => new Request(`https://wvme.etzhayyim.com${path}`);
const post = (path: string, body: string) =>
  new Request(`https://wvme.etzhayyim.com${path}`, { method: "POST", body });

afterEach(() => vi.unstubAllGlobals());

describe("meta surface", () => {
  it("answers /health with the actor DID and all eight methods", async () => {
    const res = await worker.fetch(get("/health"), {} as Env);
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.ok).toBe(true);
    expect(b.actor).toBe("did:web:wvme.etzhayyim.com");
    expect(b.methods).toEqual([
      "createScan", "listScans", "getScan", "listVulnerabilities",
      "getVulnerability", "createRemediation", "listRemediations", "getScanReport",
    ]);
  });

  it("answers /_app/meta identically to /health", async () => {
    const a = await (await worker.fetch(get("/health"), {} as Env)).json();
    const b = await (await worker.fetch(get("/_app/meta"), {} as Env)).json();
    expect(b).toEqual(a);
  });

  it("falls back to the built-in nanoid when APP_NANOID is unset, and honours it when set", async () => {
    const bare = await (await worker.fetch(get("/health"), {} as Env)).json();
    expect(bare.nanoid).toBe("vyie6ivw");
    const set = await (await worker.fetch(get("/health"), { APP_NANOID: "zzzz1111" } as Env)).json();
    expect(set.nanoid).toBe("zzzz1111");
  });
});

describe("what this edge refuses", () => {
  it("404s a path that is neither meta nor xrpc", async () => {
    const res = await worker.fetch(get("/anything-else"), {} as Env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NotFound" });
  });

  it("404s an xrpc call outside this actor's NSID namespace", async () => {
    const res = await worker.fetch(get("/xrpc/com.example.other.listScans"), {} as Env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NotFound" });
  });

  it("404s a method other than GET or POST, without calling the dispatcher", async () => {
    const calls = stubFetch();
    const req = new Request(`https://wvme.etzhayyim.com/xrpc/${NSID}`, { method: "DELETE" });
    const res = await worker.fetch(req, {} as Env);
    expect(res.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it("400s a POST whose body is not JSON, without calling the dispatcher", async () => {
    const calls = stubFetch();
    const res = await worker.fetch(post(`/xrpc/${NSID}`, "{not json"), {} as Env);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "InvalidJson" });
    expect(calls).toHaveLength(0);
  });
});

describe("proxying to the dispatcher", () => {
  it("POSTs to <DISPATCHER_URL>/xrpc/<nsid> with the internal secret", async () => {
    const calls = stubFetch();
    await worker.fetch(get(`/xrpc/${NSID}`), {
      DISPATCHER_URL: "https://d.example",
      DISPATCHER_INTERNAL_SECRET: "s3cret",
    } as Env);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://d.example/xrpc/${NSID}`);
    expect(calls[0].init.method).toBe("POST");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-internal-secret"]).toBe("s3cret");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("defaults to the production dispatcher when DISPATCHER_URL is unset", async () => {
    const calls = stubFetch();
    await worker.fetch(get(`/xrpc/${NSID}`), {} as Env);
    expect(calls[0].url).toBe(`https://dispatcher.etzhayyim.com/xrpc/${NSID}`);
  });

  it("awaits a secret-binding object rather than sending [object Object]", async () => {
    const calls = stubFetch();
    await worker.fetch(get(`/xrpc/${NSID}`), {
      DISPATCHER_INTERNAL_SECRET: { get: async () => "from-binding" },
    } as unknown as Env);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-internal-secret"]).toBe("from-binding");
  });

  it("sends an empty secret rather than the string 'undefined' when none is bound", async () => {
    const calls = stubFetch();
    await worker.fetch(get(`/xrpc/${NSID}`), {} as Env);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-internal-secret"]).toBe("");
  });

  it("lifts query parameters into the forwarded body", async () => {
    const calls = stubFetch();
    await worker.fetch(get(`/xrpc/${NSID}?limit=50&cursor=abc`), {} as Env);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ limit: "50", cursor: "abc" });
  });

  it("lets the POST body win over a query parameter of the same name", async () => {
    const calls = stubFetch();
    const req = new Request(`https://wvme.etzhayyim.com/xrpc/${NSID}?limit=50`, {
      method: "POST",
      body: JSON.stringify({ limit: 1 }),
    });
    await worker.fetch(req, {} as Env);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ limit: 1 });
  });

  it("forwards an empty POST body as {} rather than failing to parse it", async () => {
    const calls = stubFetch();
    await worker.fetch(post(`/xrpc/${NSID}`, ""), {} as Env);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({});
  });

  it("passes the dispatcher's status and body straight back to the caller", async () => {
    stubFetch(503, '{"error":"upstream is down"}');
    const res = await worker.fetch(get(`/xrpc/${NSID}`), {} as Env);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "upstream is down" });
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  // 最初に書いた版はここで「有効な body に __invalidJson が混ざらない」ことを
  // 見ていた。**それは何も守っていなかった** —— sentinel を返す guard を
  // src/app.ts から丸ごと消しても緑のままだった（有効な JSON を送っている
  // 限り marker は現れないので、当たり前のことを確かめていた）。
  // 無効な body が dispatcher に届かないことは、上の 400 のテストが
  // `calls` の長さで既に見ている。ここは代わりに、**query が body に入り
  // 転送先の URL には入らない**という別の不変条件を持つ。
  it("puts query parameters in the body, never on the forwarded URL", async () => {
    const calls = stubFetch();
    await worker.fetch(get(`/xrpc/${NSID}?limit=50&cursor=abc`), {
      DISPATCHER_URL: "https://d.example",
    } as Env);
    expect(calls[0].url).toBe(`https://d.example/xrpc/${NSID}`);
    expect(calls[0].url).not.toContain("?");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ limit: "50", cursor: "abc" });
  });
});
