import { runExpectedFailure } from "./shared/expected-failures.mjs";
import { checkCypressEntry } from "./cypress-checks.mjs";
export const expectedFailures = {};
export function expectedFailure(entry, level) {
	const issue = expectedFailures[entry.id];
	return issue?.samples[level] ? issue : undefined;
}

export function runConformance(
	entry,
	context,
	level,
	check = checkCypressEntry,
) {
	return runExpectedFailure(
		entry,
		context,
		level,
		expectedFailure(entry, level),
		check,
		() => false,
	);
}
