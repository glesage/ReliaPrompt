import { a as attr_class } from "./index2.js";
import { Z as escape_html } from "./context.js";
function EmptyState($$renderer, $$props) {
  let { icon, title, description, compact = false } = $$props;
  $$renderer.push(`<div${attr_class("empty-state", void 0, { "empty-state-compact": compact })}><div class="empty-state-icon" aria-hidden="true">${escape_html(icon)}</div> <h3>${escape_html(title)}</h3> <p>${escape_html(description)}</p></div>`);
}
export {
  EmptyState as E
};
