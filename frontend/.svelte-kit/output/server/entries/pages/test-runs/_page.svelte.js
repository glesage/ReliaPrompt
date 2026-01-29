import { a as attr_class, b as attr, c as stringify, s as store_get, e as ensure_array_like, u as unsubscribe_stores, d as attr_style } from "../../../chunks/index2.js";
import { s as selectedPrompt } from "../../../chunks/prompts.js";
import { a as ModelSelector, M as Modal, s as selectedModels } from "../../../chunks/ModelSelector.js";
import { E as EmptyState } from "../../../chunks/EmptyState.js";
import { Z as escape_html } from "../../../chunks/context.js";
function ScoreBadge($$renderer, $$props) {
  let { score, tooltip, variant = "default" } = $$props;
  function scoreToPercent(score2) {
    if (score2 > 1) return score2;
    return Math.round(score2 * 100);
  }
  const percent = scoreToPercent(score);
  const badgeClass = percent >= 90 ? "" : percent >= 80 ? "medium" : "low";
  $$renderer.push(`<span${attr_class(`score-badge ${stringify(badgeClass)}`, void 0, { "best": variant === "best" })}${attr("data-tooltip", tooltip)}>${escape_html(percent)}%</span>`);
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let runsPerTest = 1;
    let previousRuns = [];
    let detailsModalOpen = false;
    let detailsLlm = null;
    let showAllRuns = false;
    function closeTestDetailsModal() {
      detailsModalOpen = false;
      detailsLlm = null;
    }
    function formatDuration(ms) {
      if (ms < 1e3) return `${ms}ms`;
      return `${(ms / 1e3).toFixed(2)}s`;
    }
    function formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    }
    function scoreToPercent(score) {
      if (score > 1) return score;
      return Math.round(score * 100);
    }
    function getBestScore(llmResults) {
      if (!llmResults || llmResults.length === 0) return null;
      return scoreToPercent(Math.max(...llmResults.map((llm) => llm.score)));
    }
    function formatJSON(json) {
      try {
        return JSON.stringify(JSON.parse(json), null, 2);
      } catch {
        return json;
      }
    }
    $$renderer2.push(`<header class="content-header"><div class="content-header-main"><h1 class="content-title">Test Runs</h1> <p class="content-subtitle">Run your prompt against selected models and inspect results.</p></div></header> <div class="content-body">`);
    if (!store_get($$store_subs ??= {}, "$selectedPrompt", selectedPrompt)) {
      $$renderer2.push("<!--[-->");
      EmptyState($$renderer2, {
        icon: "🚀",
        title: "Select a prompt",
        description: "Pick a prompt on the left to run tests and compare LLM outputs."
      });
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<div id="test-section" class="content-grid"><section class="content-col"><div class="card"><div class="card-header"><h2>Run tests for "${escape_html(store_get($$store_subs ??= {}, "$selectedPrompt", selectedPrompt).name)}"</h2></div> <div class="muted mb-20">`);
      {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`No test cases found. Add test cases first.`);
      }
      $$renderer2.push(`<!--]--></div> <div class="helper-note mb-20">Test cases are shared across all versions of this prompt.</div> <div class="mb-20"><label for="runs-per-test">Runs per test case</label> <div class="range-row"><input type="range" id="runs-per-test" min="1" max="10"${attr("value", runsPerTest)}/> <span class="range-value">${escape_html(runsPerTest)}</span></div> <small>More runs = more reliable results, but takes longer</small></div> <div id="test-models-selection" class="model-selection-section mb-20"><label>Models to test <span class="muted">(${escape_html(store_get($$store_subs ??= {}, "$selectedModels", selectedModels).length)} selected)</span></label> `);
      ModelSelector($$renderer2, {
        selectedModels: store_get($$store_subs ??= {}, "$selectedModels", selectedModels),
        onchange: (models) => selectedModels.set(models)
      });
      $$renderer2.push(`<!----></div> <button id="run-btn"${attr("disabled", true, true)}>${escape_html("Run Tests")}</button> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div></section> <section class="content-col">`);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <div class="card"><h2>Previous Test Runs</h2> <div>`);
      if (previousRuns.length === 0) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="muted">No previous test runs for this prompt</div>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(previousRuns);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let job = each_array_1[$$index_1];
          $$renderer2.push(`<div class="previous-run-item" role="button" tabindex="0"><div class="previous-run-info"><span class="previous-run-date">${escape_html(formatDate(job.createdAt))}</span> <span class="previous-run-tests">${escape_html(job.totalTests)} tests</span></div> <div class="previous-run-status">`);
          if (job.status === "completed" && job.results) {
            $$renderer2.push("<!--[-->");
            const parsed = typeof job.results === "string" ? JSON.parse(job.results) : job.results;
            ScoreBadge($$renderer2, { score: parsed.overallScore, tooltip: "Overall" });
            $$renderer2.push(`<!----> `);
            if (getBestScore(parsed.llmResults) !== null) {
              $$renderer2.push("<!--[-->");
              ScoreBadge($$renderer2, {
                score: getBestScore(parsed.llmResults) / 100,
                tooltip: "Best LLM",
                variant: "best"
              });
            } else {
              $$renderer2.push("<!--[!-->");
            }
            $$renderer2.push(`<!--]-->`);
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
      $$renderer2.push(`<!--]--></div></div></section></div>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      let titleBadge = function($$renderer3) {
        if (detailsLlm) {
          $$renderer3.push("<!--[-->");
          ScoreBadge($$renderer3, { score: detailsLlm.score });
        } else {
          $$renderer3.push("<!--[!-->");
        }
        $$renderer3.push(`<!--]-->`);
      }, footer = function($$renderer3) {
        $$renderer3.push(`<button id="test-details-close-btn" type="button" class="secondary">Close</button>`);
      };
      Modal($$renderer2, {
        id: "test-details-modal",
        open: detailsModalOpen,
        title: detailsLlm?.llmName || "Test Details",
        wide: true,
        onclose: closeTestDetailsModal,
        titleBadge,
        footer,
        children: ($$renderer3) => {
          if (detailsLlm) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<div id="test-details-content">`);
            if (detailsLlm.durationStats) {
              $$renderer3.push("<!--[-->");
              $$renderer3.push(`<div style="background: var(--color-bg-elevated); padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;"><strong style="display: block; margin-bottom: 8px;">⏱ Response Time Statistics</strong> <div style="display: flex; gap: 24px; flex-wrap: wrap;"><div><span style="color: var(--color-text-muted);">Min:</span> <strong>${escape_html(formatDuration(detailsLlm.durationStats.minMs))}</strong></div> <div><span style="color: var(--color-text-muted);">Max:</span> <strong>${escape_html(formatDuration(detailsLlm.durationStats.maxMs))}</strong></div> <div><span style="color: var(--color-text-muted);">Average:</span> <strong>${escape_html(formatDuration(detailsLlm.durationStats.avgMs))}</strong></div></div></div>`);
            } else {
              $$renderer3.push("<!--[!-->");
            }
            $$renderer3.push(`<!--]--> <div style="margin-bottom: 16px; display: flex; justify-content: flex-end;"><button type="button"${attr_class("btn-toggle-runs", void 0, { "active": showAllRuns })}>${escape_html("Show Individual Runs")}</button></div> <!--[-->`);
            const each_array_2 = ensure_array_like(detailsLlm.testCaseResults);
            for (let i = 0, $$length = each_array_2.length; i < $$length; i++) {
              let tc = each_array_2[i];
              $$renderer3.push(`<div class="test-case-detail"><div class="header"><strong>#${escape_html(i + 1)}</strong> `);
              ScoreBadge($$renderer3, { score: tc.averageScore });
              $$renderer3.push(`<!----></div> <div style="margin-top: 10px; margin-bottom: 5px;"><strong>Input:</strong></div> <div class="json-preview">${escape_html(tc.input.substring(0, 200))}${escape_html(tc.input.length > 200 ? "..." : "")}</div> <div style="margin-top: 10px; margin-bottom: 5px;"><strong>Expected:</strong></div> <div class="json-preview">${escape_html(formatJSON(tc.expectedOutput))}</div> `);
              if (tc.runs && tc.runs.length > 0) {
                $$renderer3.push("<!--[-->");
                $$renderer3.push(`<div style="margin-top: 12px;"><div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 8px;"><strong>Run Results:</strong></div> <div style="display: flex; flex-wrap: wrap; gap: 6px;"><!--[-->`);
                const each_array_3 = ensure_array_like(tc.runs);
                for (let runIdx = 0, $$length2 = each_array_3.length; runIdx < $$length2; runIdx++) {
                  let run = each_array_3[runIdx];
                  const runScore = scoreToPercent(run.score || 0);
                  const bgColor = runScore >= 90 ? "rgba(34, 197, 94, 0.15)" : runScore >= 80 ? "rgba(234, 179, 8, 0.15)" : "rgba(239, 68, 68, 0.15)";
                  const textColor = runScore >= 90 ? "var(--color-success)" : runScore >= 80 ? "var(--color-warning)" : "var(--color-danger)";
                  const icon = run.isCorrect ? "✓" : runScore >= 80 ? "◐" : "✗";
                  $$renderer3.push(`<div${attr_style(`display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; background: ${stringify(bgColor)}; font-size: 12px;`)}${attr("title", `Run #${stringify(runIdx + 1)}: ${stringify(runScore)}%${stringify(run.durationMs !== void 0 ? ", " + formatDuration(run.durationMs) : "")}`)}><span${attr_style(`color: ${stringify(textColor)}; font-weight: bold;`)}>${escape_html(icon)}</span> <span${attr_style(`color: ${stringify(textColor)};`)}>${escape_html(runScore)}%${escape_html(run.durationMs !== void 0 ? ` · ${formatDuration(run.durationMs)}` : "")}</span></div>`);
                }
                $$renderer3.push(`<!--]--></div></div>`);
              } else {
                $$renderer3.push("<!--[!-->");
              }
              $$renderer3.push(`<!--]--> `);
              {
                $$renderer3.push("<!--[!-->");
              }
              $$renderer3.push(`<!--]--></div>`);
            }
            $$renderer3.push(`<!--]--></div>`);
          } else {
            $$renderer3.push("<!--[!-->");
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
