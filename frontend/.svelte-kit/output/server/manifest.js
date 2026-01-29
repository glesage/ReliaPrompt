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
		client: {start:"_app/immutable/entry/start.D_LTeOER.js",app:"_app/immutable/entry/app.D3THLi7E.js",imports:["_app/immutable/entry/start.D_LTeOER.js","_app/immutable/chunks/By_w4uV2.js","_app/immutable/chunks/Oh1DGDXX.js","_app/immutable/chunks/DQlnYJg7.js","_app/immutable/entry/app.D3THLi7E.js","_app/immutable/chunks/Oh1DGDXX.js","_app/immutable/chunks/BlpmaeCE.js","_app/immutable/chunks/D5utmpKv.js","_app/immutable/chunks/DQlnYJg7.js","_app/immutable/chunks/CfGrZS5K.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/","/test-cases","/test-runs"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
