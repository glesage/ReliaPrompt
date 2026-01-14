

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.tgE926u6.js","_app/immutable/chunks/DpXxpRXC.js","_app/immutable/chunks/OLrnjfeW.js","_app/immutable/chunks/SCM_VZYY.js","_app/immutable/chunks/brwGxWwK.js","_app/immutable/chunks/D0M6toz8.js","_app/immutable/chunks/CkCyRFQt.js","_app/immutable/chunks/DDc5wW8a.js","_app/immutable/chunks/Db5RXSDK.js","_app/immutable/chunks/B84XH8ny.js"];
export const stylesheets = ["_app/immutable/assets/0.FXzU_IVL.css"];
export const fonts = [];
