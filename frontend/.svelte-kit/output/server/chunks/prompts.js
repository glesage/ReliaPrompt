import { w as writable, d as derived } from "./index.js";
let messageId = 0;
function createMessagesStore() {
  const { subscribe, update } = writable([]);
  return {
    subscribe,
    show(text, type = "info", duration = 5e3) {
      const id = ++messageId;
      update((messages2) => [...messages2, { id, text, type }]);
      setTimeout(() => {
        update((messages2) => messages2.filter((m) => m.id !== id));
      }, duration);
      return id;
    },
    dismiss(id) {
      update((messages2) => messages2.filter((m) => m.id !== id));
    },
    clear() {
      update(() => []);
    }
  };
}
const messages = createMessagesStore();
const promptGroups = writable([]);
const selectedPrompt = writable(null);
const expandedGroups = writable(/* @__PURE__ */ new Set());
const versionsCache = writable({});
const promptFilter = writable("");
const promptsLoading = writable(false);
const filteredPromptGroups = derived(
  [promptGroups, promptFilter],
  ([$promptGroups, $filter]) => {
    const query = $filter.trim().toLowerCase();
    if (!query) return $promptGroups;
    return $promptGroups.filter((p) => p.name.toLowerCase().includes(query));
  }
);
function formatVersionDate(dateStr) {
  const d = new Date(dateStr);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yy}.${mm}.${dd} - ${hh}:${min}:${ss}`;
}
export {
  filteredPromptGroups as a,
  promptsLoading as b,
  expandedGroups as e,
  formatVersionDate as f,
  messages as m,
  promptFilter as p,
  selectedPrompt as s,
  versionsCache as v
};
