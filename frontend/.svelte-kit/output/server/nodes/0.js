

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.D5dEQxSe.js","_app/immutable/chunks/DpXxpRXC.js","_app/immutable/chunks/OLrnjfeW.js","_app/immutable/chunks/D5JLBBfG.js","_app/immutable/chunks/brwGxWwK.js","_app/immutable/chunks/D0M6toz8.js","_app/immutable/chunks/CkCyRFQt.js","_app/immutable/chunks/B7dw2RBZ.js","_app/immutable/chunks/Db5RXSDK.js","_app/immutable/chunks/DbPa6u5j.js"];
export const stylesheets = ["_app/immutable/assets/0.FXzU_IVL.css"];
export const fonts = [];
