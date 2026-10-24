import assert from "node:assert/strict";
import { assertNativeScenario } from "./evidence.mjs";
import { spawnSync } from "node:child_process";
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
	rmSync,
	existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { configuredOptions, expectedReport } from "../expected.mjs";
import { catalogue, checkEntry } from "../shared/checks.mjs";
export function integrationContext(root, diagnostics) {
	const consumer = mkdtempSync(path.join(tmpdir(), "ctrf-cypress-consumer-"));
	const npm = process.platform === "win32" ? "npm.cmd" : "npm";
	const env = { ...process.env, CI: "true", FORCE_COLOR: "0" };
	delete env.NODE_PATH;
	delete env.NODE_OPTIONS;
	delete env.ELECTRON_RUN_AS_NODE;
	function execute(command, args, name, expected = 0) {
		const result = spawnSync(command, args, {
			cwd: consumer,
			env,
			encoding: "utf8",
			timeout: 300000,
			maxBuffer: 16 * 1024 * 1024,
		});
		if (diagnostics)
			writeFileSync(
				path.join(diagnostics, `${name}.log`),
				`${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error ?? ""}`,
			);
		assert.ifError(result.error);
		assert.equal(result.signal, null, name);
		assert.equal(
			result.status,
			expected,
			`${name}: expected exit ${expected}\n${result.stdout}\n${result.stderr}`,
		);
		return result;
	}
	try {
		const pkg = JSON.parse(readFileSync(path.join(root, "package.json")));
		const packed = JSON.parse(
			execute(npm, ["pack", root, "--json", "--ignore-scripts"], "pack").stdout,
		)[0];
		assert.ok(
			packed.files.every((f) => !f.path.startsWith("tests/")),
			"Test sources leaked into package",
		);
		writeFileSync(
			path.join(consumer, "package.json"),
			JSON.stringify({ private: true }),
		);
		execute(
			npm,
			[
				"install",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				"--save-exact",
				`./${packed.filename}`,
				`cypress@${pkg.devDependencies.cypress}`,
			],
			"install",
		);
		cpSync(
			new URL("./fixtures/", import.meta.url),
			path.join(consumer, "fixtures"),
			{ recursive: true },
		);
		const samples = [];
		for (const scenario of [
			{
				name: "full",
				mode: "mixed",
				options: { ...configuredOptions, screenshot: true },
				exit: 1,
				video: true,
			},
			{
				name: "repeated",
				mode: "mixed",
				options: { ...configuredOptions, screenshot: true },
				exit: 1,
				video: true,
			},
			{
				name: "minimal",
				mode: "mixed",
				options: { minimal: true, screenshot: true },
				exit: 1,
			},
			{ name: "defaults", mode: "passed", options: {}, exit: 0 },
			{
				name: "no-screenshot",
				mode: "passed",
				options: { screenshot: false },
				exit: 0,
				video: true,
			},
			{
				name: "custom-type",
				mode: "passed",
				options: { testType: "component" },
				exit: 0,
			},
			{
				name: "custom-identity",
				mode: "passed",
				options: { customIdentity: true },
				exit: 0,
			},
			{
				name: "hooks-and-timeout",
				mode: "hooks",
				options: {},
				exit: 2,
				files: "fixtures/hooks.cy.cjs",
			},
			{
				name: "all-skipped",
				mode: "all-skipped",
				options: {},
				exit: 0,
				files: "fixtures/cases.cy.cjs",
			},
			{
				name: "shard-one",
				mode: "passed",
				options: { ...configuredOptions, shardId: "one" },
				exit: 0,
				files: "fixtures/cases.cy.cjs",
			},
			{
				name: "shard-two",
				mode: "passed",
				options: { ...configuredOptions, shardId: "two" },
				exit: 0,
				files: "fixtures/second.cy.cjs",
			},
			{
				name: "fractional-build-number",
				mode: "passed",
				options: { buildNumber: 1.5 },
				exit: 0,
			},
			{
				name: "nonfinite-build-number",
				mode: "passed",
				options: { buildNumber: Infinity },
				exit: 0,
			},
		]) {
			const outputDir = path.join(consumer, scenario.name);
			mkdirSync(outputDir);
			env.CTRF_FIXTURE_SCENARIO = scenario.name;
			env.CTRF_FIXTURE_MODE = scenario.mode;
			env.CTRF_FIXTURE_OPTIONS = JSON.stringify({
				...scenario.options,
				outputDir,
			});
			env.CTRF_NATIVE_OUTPUT = path.join(outputDir, "native.json");
			env.CTRF_VIDEO = String(!!scenario.video);
			env.CTRF_SCREENSHOTS = path.join(outputDir, "screenshots");
			env.CTRF_VIDEOS = path.join(outputDir, "videos");
			const start = Date.now();
			execute(
				process.execPath,
				[
					"node_modules/cypress/bin/cypress",
					"run",
					"--headless",
					"--browser",
					"electron",
					"--config-file",
					"fixtures/cypress.config.cjs",
					"--spec",
					scenario.files ?? "fixtures/cases.cy.cjs,fixtures/second.cy.cjs",
				],
				scenario.name,
				scenario.exit,
			);
			const bytes = readFileSync(path.join(outputDir, "ctrf-report.json"));
			const native = JSON.parse(readFileSync(env.CTRF_NATIVE_OUTPUT));
			assertNativeScenario(native, scenario);
			assert.equal(
				native.run.totalFailed,
				scenario.exit,
				"Intentional runner exit differs from native totals",
			);
			assert.equal(
				native.specs.length,
				scenario.files ? 1 : 2,
				"Expected Cypress specs did not execute",
			);
			assert.equal(native.browser.name, "electron", "Real browser missing");
			assert.ok(native.browser.version, "Browser version missing");
			const artifacts = {};
			for (const spec of native.specs) {
				for (const file of [
					...(spec.screenshots ?? []).map((s) => s.path),
					...(spec.video ? [spec.video] : []),
				]) {
					assert.ok(existsSync(file));
					const data = readFileSync(file);
					assert.ok(data.length > 0, "Empty browser artifact");
					artifacts[file] = data.toString("base64");
				}
			}
			samples.push({
				name: scenario.name,
				options: scenario.options,
				report: JSON.parse(bytes),
				base64: bytes.toString("base64"),
				artifacts,
				expected: expectedReport(native, scenario.options, native.actions),
				runWindow: [start, Date.now()],
			});
			if (diagnostics) {
				writeFileSync(
					path.join(diagnostics, `${scenario.name}-subject.json`),
					bytes,
				);
				writeFileSync(
					path.join(diagnostics, `${scenario.name}-native.json`),
					JSON.stringify(native, null, 2),
				);
			}
		}
		const original = samples[0];
		for (const [rule, mutate] of [
			[
				"single-json-object",
				(r) => {
					r.results.tests[0].duration = "invalid";
				},
			],
			[
				"summary-matches-final-results",
				(r) => {
					r.results.summary.passed++;
				},
			],
			[
				"retry-count-matches-history-length",
				(r) => {
					r.results.tests.find((t) => t.retries > 0).retries++;
				},
			],
			[
				"history-excludes-final-attempt",
				(r) => {
					r.results.tests.find((t) => t.retries > 0).retryAttempts[0].duration =
						999999;
				},
			],
		]) {
			const report = structuredClone(original.report);
			mutate(report);
			assert.throws(
				() =>
					checkEntry(
						catalogue.entries.find((e) => e.rule === rule),
						{
							samples: [
								{
									...original,
									report,
									bytes: Buffer.from(JSON.stringify(report)),
								},
							],
						},
					),
				`Corruption accepted: ${rule}`,
			);
		}
		return {
			samples,
			repeated: ["full", "repeated"],
			shards: ["shard-one", "shard-two"],
			warnings: [],
		};
	} finally {
		rmSync(consumer, { recursive: true, force: true });
	}
}
