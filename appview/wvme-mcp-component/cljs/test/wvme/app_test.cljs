(ns wvme.app-test
  (:require [cljs.test :refer [deftest is testing]]
            [re-frame.core :as rf]
            [wvme.app :as app]))

(deftest default-db-matches-original-scaffold-data
  (testing "app-db data holds the exact `app` object src/routes/+page.svelte
            used to render as a <script> literal, before the migration"
    (is (= "Wvme Mcp Component" (:app/title app/default-db)))
    (is (= "etzhayyim-project-wvme" (:app/project app/default-db)))
    (is (= "wvme-mcp-component" (:app/name app/default-db)))
    (is (= "appview" (:app/kind app/default-db)))
    (is (= 2 (:app/route-count app/default-db)))
    (is (= ["vyie6ivw.etzhayyim.com/*" "wvme.etzhayyim.com/*"] (:app/routes app/default-db)))
    (is (= ["AGENTGATEWAY_MCP_ROUTER_URL" "APP_CAPABILITIES" "APP_DESCRIPTION"
            "APP_DISPLAY_NAME" "APP_FRAMEWORK" "APP_NANOID"
            "APP_PERFORMER_TYPE" "APP_UI_TYPE"]
           (:app/vars app/default-db)))
    (is (true? (:app/xrpc? app/default-db)))))

(deftest route-count-matches-routes-length
  (testing "routeCount agrees with the length of the routes vector, the same
            invariant scripts/verify-appview-page-summary.cljs checks against
            wrangler.jsonc"
    (is (= (:app/route-count app/default-db) (count (:app/routes app/default-db))))))

(deftest initialize-db-event-sets-all-subs
  (testing "dispatching the :initialize-db reg-event-db handler makes every
            reg-sub resolve to default-db's value"
    (rf/dispatch-sync [:initialize-db])
    (is (= (:app/title app/default-db) @(rf/subscribe [:app/title])))
    (is (= (:app/project app/default-db) @(rf/subscribe [:app/project])))
    (is (= (:app/name app/default-db) @(rf/subscribe [:app/name])))
    (is (= (:app/kind app/default-db) @(rf/subscribe [:app/kind])))
    (is (= (:app/route-count app/default-db) @(rf/subscribe [:app/route-count])))
    (is (= (:app/routes app/default-db) @(rf/subscribe [:app/routes])))
    (is (= (:app/vars app/default-db) @(rf/subscribe [:app/vars])))
    (is (= (:app/xrpc? app/default-db) @(rf/subscribe [:app/xrpc?])))
    (is (= (:app/relative-path app/default-db) @(rf/subscribe [:app/relative-path])))))

(deftest initialize-db-is-idempotent
  (testing "dispatching :initialize-db twice leaves subs unchanged"
    (rf/dispatch-sync [:initialize-db])
    (rf/dispatch-sync [:initialize-db])
    (is (= (:app/title app/default-db) @(rf/subscribe [:app/title])))
    (is (= (:app/routes app/default-db) @(rf/subscribe [:app/routes])))))

(deftest relative-path-points-at-this-migrated-file
  (testing "relativePath was updated off the deleted svelte source path, the
            same way an earlier commit in this repo kept it in sync with a
            move (059e0f4, scripts/gen-appview-page-summary.cljs)"
    (is (= "appview/wvme-mcp-component/cljs/src/wvme/app.cljs"
           (:app/relative-path app/default-db)))
    (is (not (re-find #"svelte" (:app/relative-path app/default-db))))))
