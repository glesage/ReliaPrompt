import { b as attr, s as store_get, e as ensure_array_like, a as attr_class, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { s as selectedPrompt } from "../../../chunks/prompts.js";
import { E as EmptyState } from "../../../chunks/EmptyState.js";
import { Z as escape_html } from "../../../chunks/context.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let testCases = [];
    let activeTestCaseId = null;
    let testCaseFilter = "";
    const filteredTestCases = () => {
      const q = testCaseFilter.trim().toLowerCase();
      if (!q) return testCases;
      return testCases.filter((tc) => tc.input.toLowerCase().includes(q) || tc.expectedOutput.toLowerCase().includes(q));
    };
    $$renderer2.push(`<header class="content-header"><div class="content-header-main"><h1 class="content-title">Test Cases</h1> <p class="content-subtitle">Define inputs and expected JSON outputs. Edit fast with the split view.</p></div> <div class="content-actions"><button class="btn btn-secondary btn-sm"${attr("disabled", !store_get($$store_subs ??= {}, "$selectedPrompt", selectedPrompt), true)}>Export</button> <button class="btn btn-secondary btn-sm"${attr("disabled", !store_get($$store_subs ??= {}, "$selectedPrompt", selectedPrompt), true)}>Import</button> <button id="add-test-case-btn" class="btn btn-sm"${attr("disabled", !store_get($$store_subs ??= {}, "$selectedPrompt", selectedPrompt), true)}>New test case</button></div></header> <div class="content-body">`);
    if (!store_get($$store_subs ??= {}, "$selectedPrompt", selectedPrompt)) {
      $$renderer2.push("<!--[-->");
      EmptyState($$renderer2, {
        icon: "🗂",
        title: "Select a prompt",
        description: "Pick a prompt on the left to view and edit its test cases. Test cases are shared across all versions."
      });
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<div id="test-case-section" class="split-view"><section class="split-pane split-pane-list" aria-label="Test cases list"><div class="split-pane-header"><div class="split-pane-title">Test cases <span class="pill">${escape_html(filteredTestCases().length)}</span></div> <input type="search" placeholder="Filter test cases…" autocomplete="off"${attr("value", testCaseFilter)}/></div> <div id="test-cases-list" class="tc-list">`);
      {
        $$renderer2.push("<!--[!-->");
        if (testCases.length === 0) {
          $$renderer2.push("<!--[-->");
          EmptyState($$renderer2, {
            icon: "🧪",
            title: "No test cases yet",
            description: "Create one to start testing this prompt.",
            compact: true
          });
        } else {
          $$renderer2.push("<!--[!-->");
          if (filteredTestCases().length === 0) {
            $$renderer2.push("<!--[-->");
            EmptyState($$renderer2, {
              icon: "🔎",
              title: "No matches",
              description: "Try a different filter.",
              compact: true
            });
          } else {
            $$renderer2.push("<!--[!-->");
            $$renderer2.push(`<!--[-->`);
            const each_array = ensure_array_like(filteredTestCases());
            for (let idx = 0, $$length = each_array.length; idx < $$length; idx++) {
              let tc = each_array[idx];
              $$renderer2.push(`<button${attr_class("tc-list-item", void 0, { "active": tc.id === activeTestCaseId })} type="button"><div class="tc-list-item-top"><div class="tc-list-item-title">#${escape_html(idx + 1)}</div> <span class="pill pill-muted">${escape_html(tc.expectedOutputType)}</span></div> <div class="tc-list-item-preview">${escape_html(tc.input.replace(/\s+/g, " ").slice(0, 120) || "(empty input)")}</div></button>`);
            }
            $$renderer2.push(`<!--]-->`);
          }
          $$renderer2.push(`<!--]-->`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></div></section> <section class="split-pane split-pane-detail" aria-label="Test case editor">`);
      {
        $$renderer2.push("<!--[-->");
        EmptyState($$renderer2, {
          icon: "✍️",
          title: "Pick a test case",
          description: "Select one on the left, or create a new one.",
          compact: true
        });
      }
      $$renderer2.push(`<!--]--></section></div> <div class="helper-note">Test cases are shared across all versions of this prompt.</div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
