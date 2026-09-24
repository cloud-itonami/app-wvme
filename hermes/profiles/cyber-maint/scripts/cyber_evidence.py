#!/usr/bin/env python3
"""cyber-maint evidence probe (no_agent): measure the four cybersecurity
product repos' test-suite state under kbb. Read-only: git rev-parse only,
never fetch/merge (shared checkouts are single-writer). Appends one JSON
line per repo to the profile's append-only ledger.

Per bot-profile-scaffold discipline:
- rc alone is not the verdict: a launcher failure (classpath, missing dep)
  is UNMEASURED, not red. We capture the first stderr line as a fingerprint.
- kbb (not clojure -M) is the runtime — the kbb cutover moved these repos
  off the JVM; zap-scanner's old probe broke exactly because it used -M.
"""
import json, subprocess, sys, os, datetime

HOME = os.path.expanduser("~")
ROOT = f"{HOME}/github/com-junkawasaki/orgs"
LEDGER = f"{HOME}/.hermes/profiles/cyber-maint/workspace/cyber-ledger.jsonl"

REPOS = [
    ("zap-proxy",      f"{ROOT}/kotoba-lang/zap-proxy",      "kbb -M:test"),
    ("opencloud",      f"{ROOT}/kotoba-lang/opencloud",      "kbb -M:test"),
    ("cybersecurity",  f"{ROOT}/cloud-itonami/cybersecurity","npm run test:clj"),
    ("app-wvme",       f"{ROOT}/cloud-itonami/app-wvme",     "kbb --backend sci --classpath test run_tests.cljk"),
]

def sh(cmd, cwd, timeout=900):
    return subprocess.run(cmd, shell=isinstance(cmd, str), cwd=cwd,
                          capture_output=True, text=True, timeout=timeout)

def first_err_fingerprint(stderr):
    for line in (stderr or "").splitlines():
        if "Could not find" in line or "Unable to resolve" in line or "Error" in line:
            return line.strip()[:160]
    return (stderr or "").strip().splitlines()[:1] and (stderr or "").strip()[:160] or ""

def classify(rc, stderr):
    """red = suite ran and failed; unmeasured = launcher/environment failure."""
    s = stderr or ""
    if ("Could not find namespace" in s or "Could not resolve" in s
            or "ENOENT" in s or "not on the classpath" in s
            or "options.port" in s and False):
        return "unmeasured"
    return "red" if rc != 0 else "green"

now = datetime.datetime.now().isoformat(timespec="seconds")
lines = []
for name, path, cmd in REPOS:
    r = sh(["git", "-C", path, "rev-parse", "HEAD"], ROOT, timeout=30)
    head = r.stdout.strip() or (r.stderr.strip()[:60] if r.returncode else "")
    entry = {"date": now, "repo": name, "head": head}
    if r.returncode != 0 or not os.path.isdir(path):
        entry.update(status="unmeasured", reason=f"no checkout: {head}", cmd=cmd)
    else:
        t = sh(cmd, path, timeout=900)
        entry.update(cmd=cmd, rc=t.returncode,
                     status=classify(t.returncode, t.stderr),
                     fingerprint=first_err_fingerprint(t.stderr)[:160])
        tail = (t.stdout or "").strip().splitlines()
        for line in reversed(tail):
            if "failures" in line or "passed" in line or "agree" in line:
                entry["suite"] = line.strip()[:160]
                break
    lines.append(entry)
    print(f"MEASURE<TAB>{name}<TAB>{entry['status']}<TAB>{entry.get('suite','') or entry.get('reason','')[:80]}<TAB>{entry['head'][:9]}")

os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
with open(LEDGER, "a") as f:
    for e in lines:
        f.write(json.dumps(e, ensure_ascii=False) + "\n")

red = [e["repo"] for e in lines if e["status"] == "red"]
unmeasured = [e["repo"] for e in lines if e["status"] == "unmeasured"]
print(f"STATUS<TAB>red={len(red)}<TAB>unmeasured={len(unmeasured)}<TAB>total={len(lines)}")
if red: print("RED<TAB>" + ",".join(red))
if unmeasured: print("UNMEASURED<TAB>" + ",".join(unmeasured))
sys.exit(0)
