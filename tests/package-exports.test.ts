import { createRequire } from "node:module";
import { expect } from "expect";
import { ctrf, extra, GenerateCtrfReport } from "cypress-ctrf-json-reporter";
import {
	CTRF_TASK_NAME,
	getCtrfRuntimeStore,
	setupCtrfPlugin,
} from "cypress-ctrf-json-reporter/plugin";
import { ctrf as runtimeCtrf } from "cypress-ctrf-json-reporter/runtime";

const require = createRequire(import.meta.url);

describe("package exports", () => {
	it("supports ESM package root imports", () => {
		expect(typeof GenerateCtrfReport).toBe("function");
		expect(typeof extra).toBe("function");
		expect(typeof ctrf.extra).toBe("function");
	});

	it("supports ESM subpath imports", () => {
		expect(typeof runtimeCtrf.extra).toBe("function");
		expect(typeof setupCtrfPlugin).toBe("function");
		expect(typeof getCtrfRuntimeStore).toBe("function");
		expect(CTRF_TASK_NAME).toBe("__ctrf_runtime_message");
	});

	it("supports CJS require from package root and subpaths", () => {
		const root = require("cypress-ctrf-json-reporter");
		const runtime = require("cypress-ctrf-json-reporter/runtime");
		const plugin = require("cypress-ctrf-json-reporter/plugin");

		expect(typeof root.GenerateCtrfReport).toBe("function");
		expect(typeof root.extra).toBe("function");
		expect(typeof root.ctrf.extra).toBe("function");
		expect(typeof runtime.ctrf.extra).toBe("function");
		expect(typeof plugin.setupCtrfPlugin).toBe("function");
		expect(plugin.CTRF_TASK_NAME).toBe("__ctrf_runtime_message");
	});
});
