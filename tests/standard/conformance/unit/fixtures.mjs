import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { configuredOptions, expectedReport } from "../expected.mjs";
const require = createRequire(import.meta.url);
const {
	GenerateCtrfReport,
	setupCtrfPlugin,
	getCtrfRuntimeStore,
} = require("../../../../dist/index.cjs");
export function unitContext() {
	const directory = mkdtempSync(path.join(tmpdir(), "ctrf-cypress-unit-"));
	const samples = [];
	// Retain source bytes in the context so temporary files can be cleaned immediately.
	const cleanup = () => {
		getCtrfRuntimeStore().clearAll();
		rmSync(directory, { recursive: true, force: true });
	};
	try {
		const screenshot = path.join(directory, "suite -- failure (failed).png");
		writeFileSync(
			screenshot,
			Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0u8AAAAASUVORK5CYII=",
				"base64",
			),
		);
		const video = path.join(directory, "fixture.mp4");
		writeFileSync(
			video,
			Buffer.from("00000018667479706d703432000000006d70343269736f6d", "hex"),
		);
		const make = (title, state = "passed", retry = 0) => ({
			title: ["suite", title],
			state,
			attempts: Array.from({ length: retry + 1 }, (_, i) => ({
				state: i < retry ? "failed" : state,
				wallClockDuration: 12 + i,
				...(i < retry || state === "failed"
					? {
							error: {
								message: `attempt ${i + 1} fixture failure`,
								stack: `Error: attempt ${i + 1} fixture failure\n at fixture.js:1:1`,
							},
						}
					: {}),
			})),
		});
		const cases = [
			make("pass"),
			make("unicode ✓"),
			make("failure", "failed", 2),
			make("flaky", "passed", 1),
			make("skip", "skipped"),
			make("pending", "pending"),
			make("duplicate"),
		];
		// Native zero and absent duration inputs exercise the fallback boundary.
		cases.find((test) => test.title.at(-1) === "unicode ✓").attempts = [
			{ state: "passed" },
		];
		cases.find(
			(test) => test.title.at(-1) === "duplicate",
		).attempts[0].wallClockDuration = 0;
		for (const [name, options, mode] of [
			["full", { ...configuredOptions, screenshot: true }],
			["repeated", { ...configuredOptions, screenshot: true }],
			["minimal", { minimal: true, screenshot: true }],
			["defaults", {}],
			["no-screenshot", { screenshot: false }],
			["custom-type", { testType: "component" }],
			["empty-run-id", { runId: "" }],
			[
				"custom-identity",
				{
					customIdentity: true,
					testIdResolver: ({ name, suite }) =>
						`custom:${[...suite, name].join("/")}`,
				},
			],
			["empty-run", {}, "empty"],
			["shard-one", { ...configuredOptions, shardId: "one" }, "one"],
			["shard-two", { ...configuredOptions, shardId: "two" }, "two"],
			["fractional-build-number", { buildNumber: 1.5 }],
			["nonfinite-build-number", { buildNumber: Infinity }],
		]) {
			getCtrfRuntimeStore().clearAll();
			const callbacks = {};
			const on = (event, cb) => {
				callbacks[event] = cb;
			};
			setupCtrfPlugin(on);
			const start = Date.now();
			new GenerateCtrfReport({
				...options,
				on,
				outputDir: directory,
				outputFile: `${name}.json`,
			});
			const browser = { name: "electron", version: "fixture-version" };
			callbacks["before:run"]({ browser });
			const specs =
				mode === "empty"
					? []
					: [
							{
								spec: { relative: "fixture/one.cy.cjs" },
								tests:
									mode === "two" ? [make("second")] : structuredClone(cases),
								screenshots: [{ path: screenshot }],
								video,
							},
							...(mode === "one" || mode === "two"
								? []
								: [
										{
											spec: { relative: "fixture/two.cy.cjs" },
											tests: [make("duplicate")],
											screenshots: [],
											video: null,
										},
									]),
						];
			const actions = [];
			for (const spec of specs) {
				if (spec.tests.some((t) => t.title.at(-1) === "pass")) {
					const title = ["suite", "pass"];
					const key = `${spec.spec.relative}::${title.join(" ")}::0`;
					callbacks.task.__ctrf_runtime_message([
						{
							type: "metadata",
							testKey: key,
							data: { owner: "first", nested: { a: 1 }, list: ["one"] },
						},
						{
							type: "metadata",
							testKey: key,
							data: { owner: "last", nested: { b: 2 }, list: ["two"] },
						},
					]);
					actions.push({
						spec: spec.spec.relative,
						title,
						attempt: 0,
						extra: {
							owner: "last",
							nested: { a: 1, b: 2 },
							list: ["one", "two"],
						},
					});
				}
				callbacks["after:spec"](spec.spec, structuredClone(spec));
			}
			const flat = specs.flatMap((s) => s.tests);
			const run = {
				totalTests: flat.length,
				totalPassed: flat.filter((t) => t.state === "passed").length,
				totalFailed: flat.filter((t) => t.state === "failed").length,
				totalPending: flat.filter((t) => t.state === "pending").length,
				totalSkipped: flat.filter((t) => t.state === "skipped").length,
			};
			callbacks["after:run"](run);
			const bytes = readFileSync(path.join(directory, `${name}.json`));
			samples.push({
				name,
				options,
				artifacts: {
					[screenshot]: readFileSync(screenshot).toString("base64"),
					[video]: readFileSync(video).toString("base64"),
				},
				bytes,
				report: JSON.parse(bytes),
				expected: expectedReport({ browser, specs, run }, options, actions),
				runWindow: [start, Date.now()],
			});
		}
		return {
			samples,
			repeated: samples.slice(0, 2),
			shards: samples.filter((s) => s.name.startsWith("shard-")),
			warnings: [],
		};
	} finally {
		cleanup();
	}
}
