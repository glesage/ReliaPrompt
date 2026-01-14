import "clsx";
import { e as ensure_array_like, a as attr_class, b as attr, s as store_get, u as unsubscribe_stores, c as stringify } from "../../chunks/index2.js";
import { Y as getContext, Z as escape_html } from "../../chunks/context.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/state.svelte.js";
import { f as formatVersionDate, e as expandedGroups, v as versionsCache, s as selectedPrompt, a as filteredPromptGroups, p as promptFilter, b as promptsLoading, m as messages } from "../../chunks/prompts.js";
import { M as Modal, a as ModelSelector, b as availableModels, s as selectedModels } from "../../chunks/ModelSelector.js";
import { w as writable } from "../../chunks/index.js";
const getStores = () => {
  const stores$1 = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores$1.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores$1.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores$1.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
const config = writable({});
const configModalOpen = writable(false);
const configLoading = writable(false);
function closeConfigModal() {
  configModalOpen.set(false);
}
function Rail($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const navItems = [
      { href: "/test-cases", label: "Test Cases" },
      { href: "/test-runs", label: "Test Runs" },
      { href: "/improve", label: "Auto-Improve" }
    ];
    function isActive(href) {
      return store_get($$store_subs ??= {}, "$page", page).url.pathname === href || store_get($$store_subs ??= {}, "$page", page).url.pathname.startsWith(href + "/");
    }
    $$renderer2.push(`<aside class="app-rail" aria-label="Primary"><a class="app-rail-brand" href="/test-cases" aria-label="Relia Prompt Home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg></a> <nav class="app-rail-nav" aria-label="Sections"><!--[-->`);
    const each_array = ensure_array_like(navItems);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      $$renderer2.push(`<a${attr_class("rail-link", void 0, { "active": isActive(item.href) })}${attr("href", item.href)}${attr("aria-current", isActive(item.href) ? "page" : void 0)}><span class="rail-link-label">${escape_html(item.label)}</span></a>`);
    }
    $$renderer2.push(`<!--]--></nav> <div class="app-rail-footer"><button id="setup-btn" class="rail-btn" title="LLMs">LLMs</button></div></aside>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function PromptGroup($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { group } = $$props;
    const isExpanded = store_get($$store_subs ??= {}, "$expandedGroups", expandedGroups).has(group.promptGroupId);
    const versions = store_get($$store_subs ??= {}, "$versionsCache", versionsCache)[group.promptGroupId] || [];
    const latestVersion = versions.length > 0 ? versions[0] : null;
    $$renderer2.push(`<div${attr_class("sidebar-group", void 0, { "expanded": isExpanded })}${attr("data-group-id", group.promptGroupId)}><div class="sidebar-group-header"><span class="sidebar-expand-icon">`);
    if (isExpanded) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`);
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`);
    }
    $$renderer2.push(`<!--]--></span> <div class="sidebar-group-info"><div class="sidebar-group-name">${escape_html(group.name)}</div> <div class="sidebar-group-meta">${escape_html(group.version)} version${escape_html(group.version > 1 ? "s" : "")}</div></div> <div class="sidebar-group-actions"><button class="sidebar-action-btn view" title="View prompt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button> <button class="sidebar-action-btn delete" title="Delete all versions"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div></div> <div class="sidebar-versions">`);
    if (isExpanded) {
      $$renderer2.push("<!--[-->");
      if (versions.length === 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="sidebar-versions-loading">Loading...</div>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<!--[-->`);
        const each_array = ensure_array_like(versions);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let version = each_array[$$index];
          $$renderer2.push(`<div${attr_class("sidebar-version-item", void 0, {
            "active": store_get($$store_subs ??= {}, "$selectedPrompt", selectedPrompt)?.id === version.id
          })}><div class="sidebar-version-info"><span class="badge badge-version">v${escape_html(version.version)}</span> <span class="sidebar-version-date">${escape_html(formatVersionDate(version.createdAt))}</span></div> <div class="sidebar-version-actions"><button class="sidebar-action-btn view version-view" title="View prompt"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button> <button class="sidebar-action-btn delete version-delete" title="Delete this version"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div></div>`);
        }
        $$renderer2.push(`<!--]--> `);
        if (latestVersion) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<button class="sidebar-new-version-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> <span>Create New Version</span></button>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function PromptsPane($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    $$renderer2.push(`<aside class="app-pane app-pane-prompts" aria-label="Prompts"><div class="pane-header"><div class="pane-title">Prompts</div> <div class="pane-header-actions"><button class="btn btn-secondary btn-sm" title="Export all prompts">Export</button> <button class="btn btn-secondary btn-sm" title="Import prompts">Import</button> <button id="new-prompt-btn" class="btn btn-primary btn-sm">New</button></div></div> <div class="pane-search"><input id="prompt-filter" type="search" placeholder="Search prompts…" autocomplete="off"${attr("value", store_get($$store_subs ??= {}, "$promptFilter", promptFilter))}/> <div class="pane-search-hint">⌘K</div></div> <div class="pane-body"><div class="sidebar-list" id="sidebar-prompts">`);
    if (store_get($$store_subs ??= {}, "$promptsLoading", promptsLoading)) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="sidebar-empty">Loading...</div>`);
    } else {
      $$renderer2.push("<!--[!-->");
      if (store_get($$store_subs ??= {}, "$filteredPromptGroups", filteredPromptGroups).length === 0) {
        $$renderer2.push("<!--[-->");
        if (store_get($$store_subs ??= {}, "$promptFilter", promptFilter)) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<div class="sidebar-empty">No matches.<br/>Try a different search.</div>`);
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push(`<div class="sidebar-empty">No prompts yet.<br/>Create your first one!</div>`);
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<!--[-->`);
        const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$filteredPromptGroups", filteredPromptGroups));
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let group = each_array[$$index];
          PromptGroup($$renderer2, { group });
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></div></aside>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function ConfigModal($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let formData = {
      openai_api_key: "",
      bedrock_access_key_id: "",
      bedrock_secret_access_key: "",
      bedrock_session_token: "",
      bedrock_region: "ap-southeast-2",
      deepseek_api_key: "",
      gemini_api_key: "",
      groq_api_key: "",
      openrouter_api_key: ""
    };
    function isConfigured(provider) {
      switch (provider) {
        case "openai":
          return !!store_get($$store_subs ??= {}, "$config", config).openai_api_key;
        case "bedrock":
          return !!store_get($$store_subs ??= {}, "$config", config).bedrock_access_key_id && !!store_get($$store_subs ??= {}, "$config", config).bedrock_secret_access_key;
        case "deepseek":
          return !!store_get($$store_subs ??= {}, "$config", config).deepseek_api_key;
        case "gemini":
          return !!store_get($$store_subs ??= {}, "$config", config).gemini_api_key;
        case "groq":
          return !!store_get($$store_subs ??= {}, "$config", config).groq_api_key;
        case "openrouter":
          return !!store_get($$store_subs ??= {}, "$config", config).openrouter_api_key;
        default:
          return false;
      }
    }
    function getModelsForProvider(provider) {
      return store_get($$store_subs ??= {}, "$availableModels", availableModels).filter((m) => m.provider === provider);
    }
    function handleModelChange(provider, models) {
      const otherModels = store_get($$store_subs ??= {}, "$selectedModels", selectedModels).filter((m) => m.provider !== provider);
      const newSelection = [
        ...otherModels,
        ...models.filter((m) => m.provider === provider)
      ];
      selectedModels.set(newSelection);
    }
    {
      let footer = function($$renderer3) {
        $$renderer3.push(`<button id="config-close-btn" type="button" class="secondary">Cancel</button> <button type="submit" form="config-form"${attr("disabled", store_get($$store_subs ??= {}, "$configLoading", configLoading), true)}>${escape_html(store_get($$store_subs ??= {}, "$configLoading", configLoading) ? "Saving..." : "Save Configuration")}</button>`);
      };
      Modal($$renderer2, {
        id: "config-modal",
        open: store_get($$store_subs ??= {}, "$configModalOpen", configModalOpen),
        title: "LLM Configuration",
        onclose: closeConfigModal,
        footer,
        children: ($$renderer3) => {
          $$renderer3.push(`<form id="config-form"><div class="provider-section"><h3>OpenAI <span${attr_class("status-badge", void 0, {
            "configured": isConfigured("openai"),
            "not-configured": !isConfigured("openai")
          })}>${escape_html(isConfigured("openai") ? "Configured" : "Not configured")}</span></h3> <div class="form-group"><input type="text"${attr("value", formData.openai_api_key)} placeholder="API Key (sk-...)"/></div> `);
          if (getModelsForProvider("OpenAI").length > 0) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<div class="form-group"><label>Models</label> `);
            ModelSelector($$renderer3, {
              selectedModels: store_get($$store_subs ??= {}, "$selectedModels", selectedModels),
              onchange: (models) => handleModelChange("OpenAI", models),
              filterProvider: "OpenAI"
            });
            $$renderer3.push(`<!----></div>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--></div> <div class="provider-section"><h3>AWS Bedrock <span${attr_class("status-badge", void 0, {
            "configured": isConfigured("bedrock"),
            "not-configured": !isConfigured("bedrock")
          })}>${escape_html(isConfigured("bedrock") ? "Configured" : "Not configured")}</span></h3> <div class="form-group"><input type="text"${attr("value", formData.bedrock_access_key_id)} placeholder="Access Key ID (AKIA...)"/></div> <div class="form-group"><input type="text"${attr("value", formData.bedrock_secret_access_key)} placeholder="Secret Access Key"/></div> <div class="form-group"><input type="text"${attr("value", formData.bedrock_session_token)} placeholder="Session Token (optional)"/></div> <div class="form-group"><input type="text"${attr("value", formData.bedrock_region)} placeholder="Region (e.g., ap-southeast-2)"/></div> `);
          if (getModelsForProvider("Bedrock").length > 0) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<div class="form-group"><label>Models</label> `);
            ModelSelector($$renderer3, {
              selectedModels: store_get($$store_subs ??= {}, "$selectedModels", selectedModels),
              onchange: (models) => handleModelChange("Bedrock", models),
              filterProvider: "Bedrock"
            });
            $$renderer3.push(`<!----></div>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--></div> <div class="provider-section"><h3>Deepseek <span id="deepseek-status"${attr_class("status-badge", void 0, {
            "configured": isConfigured("deepseek"),
            "not-configured": !isConfigured("deepseek")
          })}>${escape_html(isConfigured("deepseek") ? "Configured" : "Not configured")}</span></h3> <div class="form-group"><input id="deepseek_api_key" type="text"${attr("value", formData.deepseek_api_key)} placeholder="API Key (sk-...)"/></div> `);
          if (getModelsForProvider("Deepseek").length > 0) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<div class="form-group"><label>Models</label> `);
            ModelSelector($$renderer3, {
              selectedModels: store_get($$store_subs ??= {}, "$selectedModels", selectedModels),
              onchange: (models) => handleModelChange("Deepseek", models),
              filterProvider: "Deepseek"
            });
            $$renderer3.push(`<!----></div>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--></div> <div class="provider-section"><h3>Gemini <span${attr_class("status-badge", void 0, {
            "configured": isConfigured("gemini"),
            "not-configured": !isConfigured("gemini")
          })}>${escape_html(isConfigured("gemini") ? "Configured" : "Not configured")}</span></h3> <div class="form-group"><input type="text"${attr("value", formData.gemini_api_key)} placeholder="API Key"/></div> `);
          if (getModelsForProvider("Gemini").length > 0) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<div class="form-group"><label>Models</label> `);
            ModelSelector($$renderer3, {
              selectedModels: store_get($$store_subs ??= {}, "$selectedModels", selectedModels),
              onchange: (models) => handleModelChange("Gemini", models),
              filterProvider: "Gemini"
            });
            $$renderer3.push(`<!----></div>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--></div> <div class="provider-section"><h3>Groq <span${attr_class("status-badge", void 0, {
            "configured": isConfigured("groq"),
            "not-configured": !isConfigured("groq")
          })}>${escape_html(isConfigured("groq") ? "Configured" : "Not configured")}</span></h3> <div class="form-group"><input type="text"${attr("value", formData.groq_api_key)} placeholder="API Key (gsk_...)"/></div> `);
          if (getModelsForProvider("Groq").length > 0) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<div class="form-group"><label>Models</label> `);
            ModelSelector($$renderer3, {
              selectedModels: store_get($$store_subs ??= {}, "$selectedModels", selectedModels),
              onchange: (models) => handleModelChange("Groq", models),
              filterProvider: "Groq"
            });
            $$renderer3.push(`<!----></div>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--></div> <div class="provider-section"><h3>OpenRouter <span${attr_class("status-badge", void 0, {
            "configured": isConfigured("openrouter"),
            "not-configured": !isConfigured("openrouter")
          })}>${escape_html(isConfigured("openrouter") ? "Configured" : "Not configured")}</span></h3> <div class="form-group"><input type="text"${attr("value", formData.openrouter_api_key)} placeholder="API Key (sk-or-v1-...)"/></div> `);
          if (getModelsForProvider("OpenRouter").length > 0) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<div class="form-group"><label>Models</label> `);
            ModelSelector($$renderer3, {
              selectedModels: store_get($$store_subs ??= {}, "$selectedModels", selectedModels),
              onchange: (models) => handleModelChange("OpenRouter", models),
              filterProvider: "OpenRouter"
            });
            $$renderer3.push(`<!----></div>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--></div></form>`);
        }
      });
    }
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function PromptModal($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { mode, open, onclose } = $$props;
    let name = "";
    let content = "";
    let expectedSchema = "";
    let loading = false;
    const title = "Create New Prompt";
    {
      let titleBadge = function($$renderer3) {
        {
          $$renderer3.push("<!--[!-->");
        }
        $$renderer3.push(`<!--]-->`);
      }, footer = function($$renderer3) {
        {
          $$renderer3.push("<!--[!-->");
          $$renderer3.push(`<button type="button" class="secondary">Cancel</button> <button type="submit" form="new-prompt-form"${attr("disabled", loading, true)}>`);
          {
            $$renderer3.push("<!--[!-->");
            {
              $$renderer3.push("<!--[-->");
              $$renderer3.push(`Create Prompt`);
            }
            $$renderer3.push(`<!--]-->`);
          }
          $$renderer3.push(`<!--]--></button>`);
        }
        $$renderer3.push(`<!--]-->`);
      };
      Modal($$renderer2, {
        id: "new-prompt-modal",
        open,
        title,
        wide: mode === "view",
        onclose,
        titleBadge,
        footer,
        children: ($$renderer3) => {
          {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push(`<form id="new-prompt-form">`);
            {
              $$renderer3.push("<!--[-->");
              $$renderer3.push(`<div class="form-group"><label for="new-prompt-name">Prompt Name</label> <input type="text" id="new-prompt-name"${attr("value", name)} placeholder="e.g., extract-entities" required/></div>`);
            }
            $$renderer3.push(`<!--]--> <div class="form-group"><label for="new-prompt-content">Prompt Content</label> <textarea id="new-prompt-content" class="tall" placeholder="Enter your system prompt here..." required>`);
            const $$body = escape_html(content);
            if ($$body) {
              $$renderer3.push(`${$$body}`);
            }
            $$renderer3.push(`</textarea> `);
            {
              $$renderer3.push("<!--[!-->");
            }
            $$renderer3.push(`<!--]--></div> <div class="form-group"><label for="prompt-schema">Expected Output Schema (JSON)</label> <textarea id="prompt-schema" class="medium" placeholder="{&quot;type&quot;: &quot;array&quot;, &quot;items&quot;: {&quot;type&quot;: &quot;object&quot;, &quot;properties&quot;: {&quot;name&quot;: {&quot;type&quot;: &quot;string&quot;}}}}">`);
            const $$body_1 = escape_html(expectedSchema);
            if ($$body_1) {
              $$renderer3.push(`${$$body_1}`);
            }
            $$renderer3.push(`</textarea> <small>Optional. JSON Schema for structured LLM output (used with response_format).</small></div></form>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
    }
  });
}
function MessageToast($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    if (store_get($$store_subs ??= {}, "$messages", messages).length > 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div id="app-message"><!--[-->`);
      const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$messages", messages));
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let msg = each_array[$$index];
        $$renderer2.push(`<div${attr_class(`message ${stringify(msg.type)}`)}>${escape_html(msg.text)}</div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function AppLayout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children } = $$props;
    let promptModalOpen = false;
    let promptModalMode = "new";
    function closePromptModal() {
      promptModalOpen = false;
    }
    $$renderer2.push(`<div class="app-layout app-shell">`);
    Rail($$renderer2);
    $$renderer2.push(`<!----> `);
    PromptsPane($$renderer2);
    $$renderer2.push(`<!----> <main class="app-pane app-pane-content" aria-label="Content">`);
    MessageToast($$renderer2);
    $$renderer2.push(`<!----> `);
    children($$renderer2);
    $$renderer2.push(`<!----></main></div> `);
    ConfigModal($$renderer2);
    $$renderer2.push(`<!----> `);
    PromptModal($$renderer2, {
      mode: promptModalMode,
      open: promptModalOpen,
      onclose: closePromptModal
    });
    $$renderer2.push(`<!---->`);
  });
}
function _layout($$renderer, $$props) {
  let { children } = $$props;
  AppLayout($$renderer, {
    children: ($$renderer2) => {
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    }
  });
}
export {
  _layout as default
};
