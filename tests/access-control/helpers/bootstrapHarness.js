import fs from "node:fs";
import vm from "node:vm";
import { normalizeBootstrapData } from "../../../src/api/bootstrapData.js";

const hookSource = fs.readFileSync(new URL("../../../src/api/useBootstrap.js", import.meta.url), "utf8")
  .replace(/import[^;]+;/g, "")
  .replace("export function useBootstrap", "function useBootstrap");

export function loadBootstrapHook(getBootstrap, loadingData) {
  const state = {};
  const notifications = [];
  const stateKeys = ["data", "isLoading", "error"];
  let stateIndex = 0;
  const hook = vm.runInNewContext(`${hookSource}\nuseBootstrap()`, {
    useState: (initial) => {
      const key = stateKeys[stateIndex++];
      state[key] = initial;
      return [initial, (value) => { state[key] = value; }];
    },
    useEffect: () => {},
    useRef: (initial) => ({ current: initial }),
    getBootstrap,
    loadingData,
    normalizeBootstrapData,
    getCurrentSupabaseUserId: () => "current-user",
    notifySiteLoadError: (error, details) => notifications.push({ error, details }),
    console: { debug: () => {}, error: () => {} }
  });
  return { ...hook, state, notifications };
}
