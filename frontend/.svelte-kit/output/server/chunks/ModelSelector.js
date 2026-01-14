import { b as attr, a as attr_class, s as store_get, e as ensure_array_like, u as unsubscribe_stores } from "./index2.js";
import { Z as escape_html } from "./context.js";
import { d as derived, w as writable } from "./index.js";
import "./prompts.js";
const availableModels = writable([]);
const selectedModels = writable([]);
derived(availableModels, ($models) => {
  const grouped = {};
  for (const model of $models) {
    if (!grouped[model.provider]) {
      grouped[model.provider] = [];
    }
    grouped[model.provider].push(model);
  }
  return grouped;
});
function Modal($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      open,
      title,
      wide = false,
      id,
      onclose,
      children,
      footer,
      titleBadge
    } = $$props;
    $$renderer2.push(`<div${attr("id", id)}${attr_class("modal-overlay", void 0, { "active": open })}><div${attr_class("modal", void 0, { "modal-wide": wide })}><div class="modal-header"><div class="modal-title-group"><h2>${escape_html(title)}</h2> `);
    if (titleBadge) {
      $$renderer2.push("<!--[-->");
      titleBadge($$renderer2);
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> <button class="modal-close" aria-label="Close" data-testid="modal-close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button></div> <div class="modal-body">`);
    children($$renderer2);
    $$renderer2.push(`<!----></div> `);
    if (footer) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="modal-footer">`);
      footer($$renderer2);
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}
function ModelSelector($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { selectedModels: selectedModels2, onchange, filterProvider, mode = "checkbox" } = $$props;
    const modelsToShow = filterProvider ? store_get($$store_subs ??= {}, "$availableModels", availableModels).filter((m) => m.provider === filterProvider) : store_get($$store_subs ??= {}, "$availableModels", availableModels);
    const grouped = () => {
      const result = {};
      for (const model of modelsToShow) {
        if (!result[model.provider]) {
          result[model.provider] = [];
        }
        result[model.provider].push(model);
      }
      return result;
    };
    function isSelected(provider, modelId) {
      return selectedModels2.some((m) => m.provider === provider && m.modelId === modelId);
    }
    $$renderer2.push(`<div class="model-selection-container">`);
    if (modelsToShow.length === 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="no-models">No models available. Configure API keys first.</div>`);
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(Object.entries(grouped()));
      for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
        let [provider, models] = each_array[$$index_1];
        $$renderer2.push(`<div class="model-provider-group">`);
        if (!filterProvider) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<h4>${escape_html(provider)}</h4>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]--> <div class="model-list"><!--[-->`);
        const each_array_1 = ensure_array_like(models);
        for (let $$index = 0, $$length2 = each_array_1.length; $$index < $$length2; $$index++) {
          let model = each_array_1[$$index];
          $$renderer2.push(`<label class="model-checkbox"><input${attr("type", mode)}${attr("name", mode === "radio" ? "model-selection" : void 0)}${attr("checked", isSelected(model.provider, model.id), true)}${attr("data-provider", model.provider)}${attr("data-model-id", model.id)}/> <span class="model-name">${escape_html(model.name)}</span></label>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  Modal as M,
  ModelSelector as a,
  availableModels as b,
  selectedModels as s
};
