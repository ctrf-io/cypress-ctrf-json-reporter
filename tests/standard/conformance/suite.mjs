import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { catalogue, disposition } from "./shared/checks.mjs";
import { expectedFailure, runConformance } from "./expected-failures.mjs";
import { assertNativeCapabilities } from "./cypress-checks.mjs";
import { unitContext } from "./unit/fixtures.mjs";
const level = process.env.CTRF_CONFORMANCE_LEVEL;
const manifest = JSON.parse(
	readFileSync(new URL("./cypress.json", import.meta.url), "utf8"),
);
const context =
	level === "unit"
		? unitContext()
		: JSON.parse(readFileSync(process.env.CTRF_CONFORMANCE_CONTEXT, "utf8"));
if (level !== "unit") {
	for (const sample of context.samples)
		sample.bytes = Buffer.from(sample.base64, "base64");
	for (const key of ["repeated", "shards"])
		context[key] = context[key].map((name) =>
			context.samples.find((sample) => sample.name === name),
		);
}
assertNativeCapabilities(context, manifest, level);
for (const entry of catalogue.entries) {
	const declaration = disposition(entry, manifest);
	const capability = declaration.levels?.[level] ?? declaration;
	const issue = expectedFailure(entry, level);
	test(
		`${entry.id}${issue ? ` [expected failure: ${issue.issue}]` : ""}`,
		{ skip: capability.supported ? false : capability.reason },
		() => runConformance(entry, context, level),
	);
}
after(() => {
	try {
		console.log(
			`Conformance recommendations: ${JSON.stringify(context.warnings)}`,
		);
	} finally {
		context.cleanup?.();
	}
});
