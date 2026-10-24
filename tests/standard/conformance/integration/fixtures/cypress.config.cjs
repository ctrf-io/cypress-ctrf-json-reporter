const fs = require("node:fs");
const { defineConfig } = require("cypress");
const { GenerateCtrfReport } = require("cypress-ctrf-json-reporter");
const { setupCtrfPlugin } = require("cypress-ctrf-json-reporter/plugin");
const options = JSON.parse(process.env.CTRF_FIXTURE_OPTIONS);
if (process.env.CTRF_FIXTURE_SCENARIO === "nonfinite-build-number")
	options.buildNumber = Infinity;
if (options.customIdentity)
	options.testIdResolver = ({ name, suite }) =>
		`custom:${[...suite, name].join("/")}`;
module.exports = defineConfig({
	video: process.env.CTRF_VIDEO === "true",
	screenshotOnRunFailure: true,
	trashAssetsBeforeRuns: true,
	screenshotsFolder: process.env.CTRF_SCREENSHOTS,
	videosFolder: process.env.CTRF_VIDEOS,
	defaultCommandTimeout: 1000,
	retries: { runMode: 2, openMode: 0 },
	expose: { fixtureMode: process.env.CTRF_FIXTURE_MODE },
	e2e: {
		supportFile: "fixtures/support.cjs",
		specPattern: "fixtures/*.cy.cjs",
		setupNodeEvents(on) {
			const handlers = {};
			const tasks = {};
			const specs = [];
			const actions = [];
			let browser;
			const subscribe = (event, callback) => {
				if (event === "task") Object.assign(tasks, callback);
				else {
					handlers[event] ??= [];
					handlers[event].push(callback);
				}
			};
			setupCtrfPlugin(subscribe);
			new GenerateCtrfReport({ ...options, on: subscribe });
			// Independent snapshots of native lifecycle inputs; never read CTRF output.
			subscribe("before:run", (config) => {
				browser = config.browser;
			});
			subscribe("after:spec", (_spec, result) => {
				specs.push(structuredClone(result));
			});
			subscribe("after:run", (run) => {
				fs.writeFileSync(
					process.env.CTRF_NATIVE_OUTPUT,
					JSON.stringify({ browser, specs, run, actions }),
				);
			});
			tasks.__native_fixture = (action) => {
				actions.push(action);
				return null;
			};
			on("task", tasks);
			for (const [event, list] of Object.entries(handlers))
				on(event, async (...args) => {
					for (const callback of list) await callback(...args);
				});
		},
	},
});
