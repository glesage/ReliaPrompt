

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.B1YyoZ0N.js","_app/immutable/chunks/D5utmpKv.js","_app/immutable/chunks/Oh1DGDXX.js","_app/immutable/chunks/CNxsYyag.js","_app/immutable/chunks/DQlnYJg7.js","_app/immutable/chunks/BlpmaeCE.js","_app/immutable/chunks/CfGrZS5K.js","_app/immutable/chunks/DtvwsFTp.js","_app/immutable/chunks/DrQUBQhf.js","_app/immutable/chunks/By_w4uV2.js"];
export const stylesheets = ["_app/immutable/assets/0.DGsRHxHh.css"];
export const fonts = [];
