// Native callback data and fixture actions are the oracle, never CTRF output.
export const configuredOptions = {
	runId: "standard-run",
	shardId: "standard-shard",
	appName: "fixture-app",
	appVersion: "2.0.0",
	buildName: "standard-build",
	buildNumber: 0,
	buildUrl: "https://example.test/build/0",
	repositoryName: "fixture-repository",
	repositoryUrl: "https://example.test/repository",
	branchName: "fixture-branch",
	osPlatform: "fixture-platform",
	osRelease: "fixture-release",
	osVersion: "fixture-version",
	testEnvironment: "fixture-environment",
};
export function expectedReport(native, options = {}, actions = []) {
	const tests = native.specs.flatMap((spec) =>
		spec.tests.map((test) => {
			const final = test.attempts?.at(-1);
			const attempts = test.attempts ?? [];
			const base = {
				name: test.title.join(" "),
				status: test.state,
				duration: final?.wallClockDuration ?? test.duration ?? 0,
			};
			if (options.customIdentity)
				base.testId = `custom:${test.title.join("/")}`;
			const shots = (spec.screenshots ?? []).filter((s) =>
				s.path?.includes(test.title.join(" -- ")),
			);
			const attachments = [
				...shots.map((s) => ({
					name: "screenshot",
					contentType: "image/png",
					path: s.path,
				})),
				...(spec.video
					? [{ name: "video", contentType: "video/mp4", path: spec.video }]
					: []),
			];
			if (attachments.length) base.attachments = attachments;
			if (options.minimal) return base;
			const retry = attempts.length - 1;
			const source = actions.find(
				(a) =>
					a.spec === spec.spec.relative &&
					a.title.join(" ") === base.name &&
					a.attempt === retry,
			);
			const error = final?.error;
			return {
				...base,
				rawStatus: test.state,
				type: options.testType ?? "e2e",
				filePath: spec.spec.relative,
				retries: Math.max(0, retry),
				flaky: test.state === "passed" && retry > 0,
				browser: `${native.browser.name} ${native.browser.version}`,
				...(error && test.state === "failed"
					? { message: error.message, trace: error.stack }
					: test.state === "failed" && test.displayError
						? { message: test.displayError, trace: test.displayError }
						: {}),
				...(source?.extra ? { extra: source.extra } : {}),
				sourceAttempts: attempts.map((a, index) => ({
					status: a.state,
					...(index === attempts.length - 1
						? { duration: base.duration }
						: a.wallClockDuration !== undefined
							? { duration: a.wallClockDuration }
							: {}),
				})),
			};
		}),
	);
	const environment = Object.fromEntries(
		Object.keys(configuredOptions)
			.filter((k) => k !== "runId" && options[k] !== undefined)
			.map((k) => [k, k === "buildNumber" ? Number(options[k]) : options[k]]),
	);
	const summary = {
		tests: native.run.totalTests,
		passed: native.run.totalPassed,
		failed: native.run.totalFailed,
		pending: native.run.totalPending,
		skipped: native.run.totalSkipped,
		other: 0,
	};
	return {
		reportFormat: "CTRF",
		specVersion: "0.2.0",
		generatedBy: "cypress-ctrf-json-reporter",
		...(options.runId ? { runId: options.runId } : {}),
		results: { tool: { name: "cypress" }, summary, tests, environment },
	};
}
