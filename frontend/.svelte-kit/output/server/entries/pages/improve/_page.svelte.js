import { s as store_get, b as attr, e as ensure_array_like, a as attr_class, d as attr_style, u as unsubscribe_stores, c as stringify } from "../../../chunks/index2.js";
import { s as selectedPrompt } from "../../../chunks/prompts.js";
import { a as ModelSelector, M as Modal } from "../../../chunks/ModelSelector.js";
import { E as EmptyState } from "../../../chunks/EmptyState.js";
import { S as ScoreBadge } from "../../../chunks/ScoreBadge.js";
import { Z as escape_html } from "../../../chunks/context.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let maxIterations = 3;
    let runsPerLlm = 1;
    let improvementModel = [];
    let benchmarkModels = [];
    let progress = 0;
    let log = [];
    let bestScore = null;
    let previousJobs = [];
    let templateModalOpen = false;
    let templateText = "";
    let loadingTemplate = false;
    let savingTemplate = false;
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    }
    $$renderer2.push(`<header class="content-header"><div class="content-header-main"><h1 class="content-title">Auto-Improve</h1> <p class="content-subtitle">Let an LLM iteratively improve your prompt by testing and refining based on test case results.</p></div> <div class="content-actions"><button type="button" class="btn btn-secondary btn-sm">Edit Template</button></div></header> <div class="content-body">`);
    if (!store_get($$store_subs ??= {}, "$selectedPrompt", selectedPrompt)) {
      $$renderer2.push("<!--[-->");
      EmptyState($$renderer2, {
        icon: "🧠",
        title: "Select a prompt",
        description: "Pick a prompt to auto-improve using LLM-based iterative refinement."
      });
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<div id="improve-section" class="content-grid"><section class="content-col"><div class="card"><h2>Improvement Settings</h2> <div class="muted mb-20">`);
      {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`No test cases found. Add test cases first.`);
      }
      $$renderer2.push(`<!--]--></div> <div class="form-group"><label for="max-iterations">Max iterations</label> <div class="range-row"><input type="range" id="max-iterations" min="1" max="10"${attr("value", maxIterations)}/> <span class="range-value">${escape_html(maxIterations)}</span></div> <small>Each iteration tests, analyzes, and improves the prompt</small></div> <div class="form-group"><label for="runs-per-llm">Runs per LLM per test</label> <div class="range-row"><input type="range" id="runs-per-llm" min="1" max="5"${attr("value", runsPerLlm)}/> <span class="range-value">${escape_html(runsPerLlm)}</span></div> <small>More runs = more reliable scores, but takes longer</small></div> <div id="improvement-model-selection" class="model-selection-section form-group"><label>Improvement Model <span class="muted">(picks one to rewrite the prompt)</span></label> `);
      ModelSelector($$renderer2, {
        selectedModels: improvementModel,
        onchange: (models) => {
          improvementModel = models.length > 0 ? [models[models.length - 1]] : [];
        },
        mode: "radio"
      });
      $$renderer2.push(`<!----></div> <div id="benchmark-models-selection" class="model-selection-section form-group"><label>Benchmark Models <span class="muted">(${escape_html(benchmarkModels.length)} selected)</span></label> `);
      ModelSelector($$renderer2, {
        selectedModels: benchmarkModels,
        onchange: (models) => benchmarkModels = models
      });
      $$renderer2.push(`<!----></div> <button id="start-btn"${attr("disabled", true, true)}>${escape_html("Start Improvement")}</button></div> <div class="card"><h2>Previous Jobs</h2> `);
      if (previousJobs.length === 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="muted">No improvement jobs for this prompt yet</div>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<!--[-->`);
        const each_array = ensure_array_like(previousJobs);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let job = each_array[$$index];
          $$renderer2.push(`<div class="previous-run-item" role="button" tabindex="0"><div class="previous-run-info"><span class="previous-run-date">${escape_html(formatDate(job.createdAt))}</span> <span class="previous-run-tests">${escape_html(job.currentIteration)}/${escape_html(job.maxIterations)} iterations</span></div> <div class="previous-run-status">`);
          if (job.status === "completed" && job.bestScore !== void 0) {
            $$renderer2.push("<!--[-->");
            ScoreBadge($$renderer2, { score: job.bestScore, tooltip: "Best score" });
          } else {
            $$renderer2.push("<!--[!-->");
          }
          $$renderer2.push(`<!--]--> <span${attr_class("status-indicator", void 0, {
            "success": job.status === "completed",
            "failure": job.status === "failed",
            "pending": job.status === "pending" || job.status === "running"
          })}>${escape_html(job.status.charAt(0).toUpperCase() + job.status.slice(1))}</span></div></div>`);
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]--></div></section> <section class="content-col">`);
      if (log.length > 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="card"><div class="progress-header"><h2>Progress</h2> `);
        {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]--> <span id="status-badge"${attr_class("status-indicator", void 0, { "success": bestScore !== null })}>${escape_html("Completed")}</span></div> `);
        {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]--> <div id="progress-section" class="progress-section"><div class="progress-label">Overall Progress</div> <div class="progress-bar-container"><div class="progress-bar"${attr_style(`width: ${stringify(Math.round(progress))}%`)}>${escape_html(Math.round(progress))}%</div></div></div> <div id="log-output" class="log-container" style="margin-top: 16px;"><!--[-->`);
        const each_array_1 = ensure_array_like(log);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let line = each_array_1[$$index_1];
          $$renderer2.push(`<div${attr_class("log-line", void 0, {
            "success": line.includes("✓") || line.toLowerCase().includes("success") || line.toLowerCase().includes("complete"),
            "error": line.includes("✗") || line.toLowerCase().includes("error") || line.toLowerCase().includes("fail"),
            "info": line.includes("ℹ") || line.includes("→") || line.toLowerCase().includes("starting") || line.toLowerCase().includes("iteration")
          })}>${escape_html(line)}</div>`);
        }
        $$renderer2.push(`<!--]--></div></div> `);
        {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]-->`);
      } else {
        $$renderer2.push("<!--[!-->");
        EmptyState($$renderer2, {
          icon: "⚡",
          title: "Ready to improve",
          description: "Configure settings and start the improvement process to see progress and results here."
        });
      }
      $$renderer2.push(`<!--]--></section></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      let footer = function($$renderer3) {
        $$renderer3.push(`<button type="button" class="secondary"${attr("disabled", loadingTemplate, true)}>Reset to Default</button> <button type="button" class="secondary">Cancel</button> <button type="button"${attr("disabled", savingTemplate, true)}>${escape_html("Save Template")}</button>`);
      };
      Modal($$renderer2, {
        open: templateModalOpen,
        title: "Improvement Prompt Template",
        wide: true,
        onclose: () => templateModalOpen = false,
        footer,
        children: ($$renderer3) => {
          {
            $$renderer3.push("<!--[!-->");
            $$renderer3.push(`<div class="form-group"><label for="template-text">Template</label> <textarea id="template-text" class="tall" placeholder="Enter the improvement prompt template..." style="min-height: 300px;">`);
            const $$body = escape_html(templateText);
            if ($$body) {
              $$renderer3.push(`${$$body}`);
            }
            $$renderer3.push(`</textarea> <small>Available variables: {{original_prompt}}, {{test_results}}, {{test_cases}}</small></div>`);
          }
          $$renderer3.push(`<!--]-->`);
        }
      });
    }
    $$renderer2.push(`<!---->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
