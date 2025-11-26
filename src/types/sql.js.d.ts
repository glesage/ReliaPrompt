declare module "sql.js" {
	export interface SqlJsStatic {
		Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
	}

	export interface Database {
		run(sql: string, params?: unknown[]): Database;
		exec(sql: string): QueryExecResult[];
		prepare(sql: string): Statement;
		export(): Uint8Array;
		close(): void;
		getRowsModified(): number;
	}

	export interface Statement {
		bind(params?: unknown[]): boolean;
		step(): boolean;
		getAsObject(params?: Record<string, unknown>): Record<string, unknown>;
		get(params?: Record<string, unknown>): unknown[];
		getColumnNames(): string[];
		free(): void;
		reset(): void;
		run(params?: unknown[]): void;
	}

	export interface QueryExecResult {
		columns: string[];
		values: unknown[][];
	}

	function initSqlJs(config?: {
		locateFile?: (filename: string) => string;
	}): Promise<SqlJsStatic>;
	export default initSqlJs;
}
