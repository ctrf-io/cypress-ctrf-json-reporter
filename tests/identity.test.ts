import { describe, it } from "mocha";
import assert from "node:assert/strict";
import { runIdentity, testIdentity } from "../src/identity";
import { GenerateCtrfReport } from "../src/generate-report";

describe("identity lifecycle", () => {
	it("keeps shared run/shard identity and logical test IDs in minimal output", () => {
		const one = new GenerateCtrfReport({
			on: () => {},
			minimal: true,
			runId: "run",
			shardId: "one",
		});
		const two = new GenerateCtrfReport({
			on: () => {},
			minimal: true,
			runId: "run",
			shardId: "two",
		});
		const result = {
			spec: { relative: "a.cy.ts" },
			screenshots: [],
			tests: [
				{
					title: ["suite", "case"],
					state: "passed",
					duration: 1,
					attempts: [{ state: "failed" }, { state: "passed" }],
				},
			],
		};
		for (const reporter of [one, two]) {
			(reporter as any).updateCtrfResultsFromAfterSpecResults(result);
			reporter.setEnvironmentDetails(reporter.reporterConfigOptions);
		}
		assert.equal(one.ctrfReport.runId, two.ctrfReport.runId);
		assert.equal(
			one.ctrfReport.results.tests[0].testId,
			two.ctrfReport.results.tests[0].testId,
		);
		assert.notEqual(
			one.ctrfReport.results.tests[0].executionId,
			two.ctrfReport.results.tests[0].executionId,
		);
		assert.equal(two.ctrfEnvironment.shardId, "two");
		assert.ok(one.ctrfReport.results.tests[0].attemptId);
		assert.notEqual(
			one.ctrfReport.results.tests[0].attemptId,
			two.ctrfReport.results.tests[0].attemptId,
		);
	});
	it("normalizes paths without merging different suite tuples", () => {
		assert.equal(
			testIdentity("cypress", { name: "same", filePath: "test\\a.ts" }),
			testIdentity("cypress", { name: "same", filePath: "test/a.ts" }),
		);
		assert.notEqual(
			testIdentity("cypress", { name: "same", suite: ["a/b", "c"] }),
			testIdentity("cypress", { name: "same", suite: ["a", "b/c"] }),
		);
		assert.notEqual(runIdentity(), runIdentity());
	});
});
