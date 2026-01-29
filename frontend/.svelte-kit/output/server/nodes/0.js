

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const universal = {
  "prerender": true,
  "ssr": false
};
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.CZhgvPAY.js","_app/immutable/chunks/DJX18OcT.js","_app/immutable/chunks/J2kTv08O.js","_app/immutable/chunks/CImCAzC8.js","_app/immutable/chunks/8J-ESnej.js","_app/immutable/chunks/D1iiyE8s.js","_app/immutable/chunks/kHTcSwTF.js","_app/immutable/chunks/h8IXuia-.js","_app/immutable/chunks/BhuDEorp.js","_app/immutable/chunks/D4bd7c4X.js"];
export const stylesheets = ["_app/immutable/assets/0.DGsRHxHh.css"];
export const fonts = [];
