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
		client: {start:"_app/immutable/entry/start.DTAX7YRc.js",app:"_app/immutable/entry/app.J-ctt7_o.js",imports:["_app/immutable/entry/start.DTAX7YRc.js","_app/immutable/chunks/D4bd7c4X.js","_app/immutable/chunks/J2kTv08O.js","_app/immutable/chunks/8J-ESnej.js","_app/immutable/entry/app.J-ctt7_o.js","_app/immutable/chunks/J2kTv08O.js","_app/immutable/chunks/D1iiyE8s.js","_app/immutable/chunks/DJX18OcT.js","_app/immutable/chunks/8J-ESnej.js","_app/immutable/chunks/kHTcSwTF.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
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
