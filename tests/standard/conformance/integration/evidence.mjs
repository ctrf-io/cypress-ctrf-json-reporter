import assert from "node:assert/strict";
// Independent inventory prevents an uncaught fixture error masquerading as an intended failure.
export function assertNativeScenario(native, scenario) {
	const first = scenario.files !== "fixtures/second.cy.cjs";
	const second = !scenario.files || scenario.files === "fixtures/second.cy.cjs";
	let expected = [];
	if (scenario.mode === "hooks")
		expected = [
			["fixtures/hooks.cy.cjs", "hook failure unreached", "failed"],
			["fixtures/hooks.cy.cjs", "hook failure skipped after hook", "skipped"],
			["fixtures/hooks.cy.cjs", "timeout times out", "failed"],
		];
	else if (scenario.mode === "all-skipped")
		expected = [
			["fixtures/cases.cy.cjs", "suite skip", "pending"],
			["fixtures/cases.cy.cjs", "suite pending", "pending"],
		];
	else {
		if (first)
			expected.push(
				...[
					"suite pass",
					"suite isolated",
					"suite unicode ✓",
					"suite first duplicate",
					"suite second duplicate",
				].map((name) => ["fixtures/cases.cy.cjs", name, "passed"]),
			);
		if (second)
			expected.push(["fixtures/second.cy.cjs", "second file pass", "passed"]);
		if (scenario.mode === "mixed")
			expected.push(
				["fixtures/cases.cy.cjs", "suite skip", "pending"],
				["fixtures/cases.cy.cjs", "suite pending", "pending"],
				["fixtures/cases.cy.cjs", "suite flaky", "passed"],
				["fixtures/cases.cy.cjs", "suite failure", "failed"],
			);
	}
	const sort = (values) =>
		values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
	assert.deepEqual(
		sort(
			native.specs.flatMap((s) =>
				s.tests.map((t) => [s.spec.relative, t.title.join(" "), t.state]),
			),
		),
		sort(expected),
		"Native scenario case inventory/outcomes differ",
	);
	for (const spec of native.specs)
		for (const test of spec.tests) {
			if (test.title.at(-1) === "flaky")
				assert.equal(
					test.attempts.length,
					2,
					"Recovery fixture did not retry once",
				);
			if (test.title.at(-1) === "failure")
				assert.equal(
					test.attempts.length,
					3,
					"Exhaustion fixture did not retry twice",
				);
		}
	const nonSkipped = expected.filter(
		(t) => !["pending", "skipped"].includes(t[2]),
	);
	if (nonSkipped.length)
		assert.ok(
			native.actions.some((a) => a.browser?.name === "electron") ||
				scenario.mode === "hooks",
			"Missing independent browser execution evidence",
		);
}
