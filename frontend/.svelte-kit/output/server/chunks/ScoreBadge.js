import { a as attr_class, b as attr, c as stringify } from "./index2.js";
import { Z as escape_html } from "./context.js";
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
export {
  ScoreBadge as S
};
