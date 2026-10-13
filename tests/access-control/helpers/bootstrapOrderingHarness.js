import fs from "node:fs";
import vm from "node:vm";
import { normalizeBootstrapData } from "../../../src/api/bootstrapData.js";

const hookSource = fs.readFileSync(new URL("../../../src/api/useBootstrap.js", import.meta.url), "utf8")
  .replace(/import[^;]+;/g, "")
  .replace("export function useBootstrap", "function useBootstrap");

// Several hook instances share the real module-level cache and request state.
// Only React's scheduling/state primitives and the external loader are supplied.
export function loadBootstrapOrderingRuntime(getBootstrap, loadingData) {
  let currentInstance;
  let userId = "current-user";
  const notifications = [];
  const useBootstrap = vm.runInNewContext(`${hookSource}\nuseBootstrap`, {
    useState: (initial) => {
      const instance = currentInstance;
      const index = instance.stateIndex++;
      if (!(index in instance.values)) instance.values[index] = typeof initial === "function" ? initial() : initial;
      return [instance.values[index], (update) => {
        instance.values[index] = typeof update === "function" ? update(instance.values[index]) : update;
      }];
    },
    useRef: (initial) => {
      const instance = currentInstance;
      const index = instance.refIndex++;
      return instance.refs[index] ??= { current: initial };
    },
    useEffect: (effect) => {
      if (!currentInstance.mounted) currentInstance.effects.push(effect);
    },
    getBootstrap,
    loadingData,
    normalizeBootstrapData,
    getCurrentSupabaseUserId: () => userId,
    notifySiteLoadError: (error, details) => notifications.push({ error, details }),
    console: { debug: () => {}, error: () => {} }
  });

  const mount = ({ runEffects = true } = {}) => {
    const instance = { values: [], refs: [], effects: [], cleanups: [], mounted: false };
    let rendered;
    const render = () => {
      currentInstance = instance;
      instance.stateIndex = 0;
      instance.refIndex = 0;
      rendered = useBootstrap();
      instance.mounted = true;
      return rendered;
    };
    render();
    if (runEffects) instance.cleanups = instance.effects.map((effect) => effect());
    return {
      render,
      refresh: (options) => rendered.refresh(options),
      unmount: () => instance.cleanups.forEach((cleanup) => cleanup?.()),
      get state() {
        return { data: instance.values[0], isLoading: instance.values[1], error: instance.values[2] };
      }
    };
  };
  return { mount, notifications, setUserId: (nextUserId) => { userId = nextUserId; } };
}
