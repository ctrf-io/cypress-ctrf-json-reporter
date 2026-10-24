import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { integrationContext } from "./integration/prepare.mjs";
import { reportPath, writeReport } from "./reporters/ctrf.mjs";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const level = process.argv[2];
assert.ok(["unit", "integration"].includes(level));
const scratch = mkdtempSync(path.join(tmpdir(), "ctrf-cypress-conformance-"));
const start = Date.now();
rmSync(reportPath(level), { force: true });
try {
	const env = { ...process.env, CTRF_CONFORMANCE_LEVEL: level };
	if (level === "integration") {
		const diagnostics = process.env.CTRF_STANDARD_ARTIFACTS;
		if (diagnostics) mkdirSync(diagnostics, { recursive: true });
		env.CTRF_CONFORMANCE_CONTEXT = path.join(scratch, "context.json");
		writeFileSync(
			env.CTRF_CONFORMANCE_CONTEXT,
			JSON.stringify(integrationContext(root, diagnostics)),
		);
	}
	const result = spawnSync(
		process.execPath,
		[
			"--test",
			"--test-reporter=spec",
			"--test-reporter-destination=stdout",
			"--test-reporter=./tests/standard/conformance/reporters/node.mjs",
			"--test-reporter-destination=stdout",
			`tests/standard/conformance/${level}/conformance.test.mjs`,
		],
		{ cwd: root, env, stdio: "inherit", timeout: 300_000 },
	);
	assert.ifError(result.error);
	assert.equal(result.signal, null);
	assert.ok(
		existsSync(reportPath(level)),
		"Native runner did not emit its CTRF result",
	);
	process.exitCode = result.status;
} catch (error) {
	writeReport(
		[
			{
				name: `${level} setup`,
				status: "failed",
				message: error.message,
				trace: error.stack,
			},
		],
		level,
		"node:test",
		start,
	);
	throw error;
} finally {
	rmSync(scratch, { recursive: true, force: true });
}
