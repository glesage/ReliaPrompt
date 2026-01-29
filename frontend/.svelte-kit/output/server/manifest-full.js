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
		client: {start:"_app/immutable/entry/start.B5p1QBVt.js",app:"_app/immutable/entry/app.CfNlQAYJ.js",imports:["_app/immutable/entry/start.B5p1QBVt.js","_app/immutable/chunks/DvarTlqg.js","_app/immutable/chunks/J2kTv08O.js","_app/immutable/chunks/8J-ESnej.js","_app/immutable/entry/app.CfNlQAYJ.js","_app/immutable/chunks/J2kTv08O.js","_app/immutable/chunks/D1iiyE8s.js","_app/immutable/chunks/DJX18OcT.js","_app/immutable/chunks/8J-ESnej.js","_app/immutable/chunks/kHTcSwTF.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/test-cases",
				pattern: /^\/test-cases\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/test-runs",
				pattern: /^\/test-runs\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
