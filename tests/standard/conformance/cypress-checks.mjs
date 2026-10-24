import assert from "node:assert/strict";

import { checkEntry, valuesAt } from "./shared/checks.mjs";
export function checkCypressEntry(entry, context) {
	for (const sample of context.samples) {
		const actual = sample.report.results.tests;
		const expected = sample.expected.results.tests;
		if (entry.path === "results.tests[].extra")
			assert.deepEqual(
				actual.map((t) => t.extra),
				expected.map((t) => t.extra),
				`${sample.name}: runtime metadata source mapping`,
			);
		if (
			["results.tests[].message", "results.tests[].trace"].includes(entry.path)
		) {
			const key = entry.path.split(".").at(-1);
			assert.deepEqual(
				actual.map((t) => t[key]),
				expected.map((t) => t[key]),
				`${sample.name}: native ${key} mapping`,
			);
		}
		if (entry.path === "results.tests[].attachments") {
			assert.deepEqual(
				actual.map((t) =>
					t.attachments?.map(({ name, contentType, path }) => ({
						name,
						contentType,
						path,
					})),
				),
				expected.map((t) => t.attachments),
				`${sample.name}: native attachment mapping`,
			);
			for (const t of actual)
				for (const attachment of t.attachments ?? [])
					assert.ok(
						!!sample.artifacts?.[attachment.path],
						`${sample.name}: missing source attachment`,
					);
		}
		if (entry.path === "results.tests[].screenshot") {
			for (let i = 0; i < actual.length; i++) {
				const shots =
					expected[i].attachments?.filter((a) => a.name === "screenshot") ?? [];
				const picked =
					shots.find((a) => a.path.includes("(failed)")) ?? shots.at(-1);
				const want =
					!sample.options?.minimal && sample.options?.screenshot && picked
						? sample.artifacts?.[picked.path]
						: undefined;
				assert.equal(
					actual[i].screenshot,
					want,
					`${sample.name}: screenshot bytes differ from native artifact`,
				);
			}
		}
	}
	checkEntry(entry, context);
}

export function assertNativeCapabilities(context, manifest, level) {
	for (const [path, declaration] of Object.entries(manifest.properties)) {
		const capability = declaration.levels?.[level] ?? declaration;
		if (!capability.supported)
			assert.equal(
				context.samples.flatMap((s) => valuesAt(s.report, path)).length,
				0,
				`Emitted field is incorrectly declared unsupported at ${level}: ${path}`,
			);
	}
}
