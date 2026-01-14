export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.l1SgzkY6.js",app:"_app/immutable/entry/app.BAq1GE8x.js",imports:["_app/immutable/entry/start.l1SgzkY6.js","_app/immutable/chunks/B84XH8ny.js","_app/immutable/chunks/OLrnjfeW.js","_app/immutable/chunks/brwGxWwK.js","_app/immutable/entry/app.BAq1GE8x.js","_app/immutable/chunks/OLrnjfeW.js","_app/immutable/chunks/D0M6toz8.js","_app/immutable/chunks/DpXxpRXC.js","_app/immutable/chunks/brwGxWwK.js","_app/immutable/chunks/CkCyRFQt.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/","/improve","/test-cases","/test-runs"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
