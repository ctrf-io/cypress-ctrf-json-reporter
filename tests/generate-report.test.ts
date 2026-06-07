import { GenerateCtrfReport } from "../src/generate-report";
import type { Attachment } from "ctrf";
import type {
	CypressAfterRun,
	CypressTest,
	CypressTestState,
} from "../types/cypress";
import { expect } from "expect";
import fs = require("node:fs");
import sinon from "sinon";

describe("GenerateCtrfReport", () => {
	let reporter: GenerateCtrfReport;
	let mockOn: sinon.SinonStub;
	let readFileSyncStub: sinon.SinonStub;

	beforeEach(() => {
		mockOn = sinon.stub();
		sinon.stub(fs, "existsSync").returns(true);
		sinon.stub(fs, "mkdirSync");
		sinon.stub(fs, "writeFileSync");
		readFileSyncStub = sinon.stub(fs, "readFileSync");
		reporter = new GenerateCtrfReport({ on: mockOn });
	});

	afterEach(() => {
		sinon.restore();
	});

	describe("Validation and events", () => {
		it("should register listeners for after:spec", () => {
			sinon.assert.calledWith(mockOn, "after:spec", sinon.match.func);
		});

		it("should register listeners for after:run events", () => {
			sinon.assert.calledWith(mockOn, "after:run", sinon.match.func);
		});
	});

	describe("Set config options", () => {
		describe("filename", () => {
			it("should set filename from if present in options", () => {
				const filenameOption = "custom-filename.json";
				const reporterWithFilename = new GenerateCtrfReport({
					on: mockOn,
					outputFile: filenameOption,
				});
				expect((reporterWithFilename as any).filename).toEqual(filenameOption);
			});

			it("should use default filename if filename is not present in options", () => {
				expect((reporter as any).outputFile).toEqual(
					(reporter as any).defaultFilename,
				);
			});
		});

		describe("setFilename", () => {
			it("should add .json extension if none provided", () => {
				(reporter as any).setFilename("custom-filename");
				expect((reporter as any).filename).toBe("custom-filename.json");
			});

			it("should keep .json extension if already provided", () => {
				(reporter as any).setFilename("custom-filename.json");
				expect((reporter as any).filename).toBe("custom-filename.json");
			});

			it("should append .json to any other extensions", () => {
				(reporter as any).setFilename("custom-filename.txt");
				expect((reporter as any).filename).toBe("custom-filename.txt.json");
			});
		});
	});

	describe("updateCtrfResultsFromAfterSpecResults", () => {
		it("should update the ctrfReport with required test properties", () => {
			const mockTest: CypressTest = {
				title: ["Sample Test"],
				state: "passed",
				duration: 100,
			};

			(reporter as any).updateCtrfResultsFromAfterSpecResults({
				tests: [mockTest],
			});

			const updatedTestResult = reporter.ctrfReport.results.tests[0];

			expect(updatedTestResult.name).toBe(mockTest.title.join(" "));
			expect(updatedTestResult.status).toBe(mockTest.state);
			expect(updatedTestResult.duration).toBe(mockTest.duration);
		});

		for (const [testTitle, status, duration] of [
			[["Test 1"], "passed", 100],
			[["Test 2"], "failed", 200],
			[["Test 4"], "pending", 300],
			[["Test 3"], "skipped", 400],
		] as const) {
			it(`should correctly update the ctrfReport for test "${testTitle.join(" ")}" with status "${status}" and duration ${duration}`, () => {
				const mockTest: CypressTest = {
					title: [...testTitle],
					state: status as CypressTestState,
					duration: duration,
				};

				(reporter as any).updateCtrfResultsFromAfterSpecResults({
					tests: [mockTest],
				});

				const updatedTestResult =
					reporter.ctrfReport.results.tests[
						reporter.ctrfReport.results.tests.length - 1
					];

				expect(updatedTestResult.name).toBe(testTitle.join(" "));
				expect(updatedTestResult.status).toBe(status);
				expect(updatedTestResult.duration).toBe(duration);
			});
		}
		it("should use wallClockDuration from the last attempt if duration is absent", () => {
			const mockTest: CypressTest = {
				title: ["Test without duration"],
				state: "passed",
				attempts: [
					{
						state: "passed",
						wallClockDuration: 150,
					},
					{
						state: "passed",
						wallClockDuration: 250,
					},
				],
			};

			(reporter as any).updateCtrfResultsFromAfterSpecResults({
				tests: [mockTest],
			});

			const updatedTestResult = reporter.ctrfReport.results.tests[0];

			expect(updatedTestResult.name).toBe(mockTest.title.join(" "));
			expect(updatedTestResult.status).toBe(mockTest.state);
			expect(updatedTestResult.duration).toBe(250);
		});

		it("should default duration to 0 if both duration and attempts are absent", () => {
			const mockTest: CypressTest = {
				title: ["Test without duration or attempts"],
				state: "passed",
			};

			(reporter as any).updateCtrfResultsFromAfterSpecResults({
				tests: [mockTest],
			});

			const updatedTestResult = reporter.ctrfReport.results.tests[0];

			expect(updatedTestResult.name).toBe(mockTest.title.join(" "));
			expect(updatedTestResult.status).toBe(mockTest.state);
			expect(updatedTestResult.duration).toBe(0);
		});

		it("should add screenshot as base64 string when screenshot option is true", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
				minimal: false,
			});

			readFileSyncStub.returns("base64-screenshot-data");

			const mockTest: CypressTest = {
				title: ["Test", "With Screenshot"],
				state: "passed",
			};

			const mockResults = {
				tests: [mockTest],
				screenshots: [{ path: "/path/to/Test -- With Screenshot.png" }],
			};

			(reporter as any).updateCtrfResultsFromAfterSpecResults(mockResults);

			const updatedTestResult = reporter.ctrfReport.results.tests[0];
			expect(updatedTestResult.attachments).toBeDefined();
			if (updatedTestResult.attachments) {
				expect(updatedTestResult.attachments.length).toBeGreaterThan(0);
				expect(
					updatedTestResult.attachments.some((a) => a.name === "screenshot"),
				).toBe(true);
			}
			expect(updatedTestResult.screenshot).toBe("base64-screenshot-data");
		});

		it("should call getScreenshot with the right parameters", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
				minimal: false,
			});

			// Spy on getScreenshot method
			const getScreenshotSpy = sinon
				.stub(reporter as any, "getScreenshot")
				.returns("base64-screenshot-data");

			const mockTest: CypressTest = {
				title: ["Test", "With Spy"],
				state: "passed",
			};

			const mockResults = {
				tests: [mockTest],
				screenshots: [{ path: "/path/to/Test -- With Spy.png" }],
			};

			(reporter as any).updateCtrfResultsFromAfterSpecResults(mockResults);

			// Verify getScreenshot was called with the right parameters
			sinon.assert.calledWith(
				getScreenshotSpy,
				mockTest,
				mockResults,
				(reporter as any).reporterConfigOptions.screenshot,
			);

			// Clean up
			getScreenshotSpy.restore();
		});

		it("should call getAttachments to gather all attachments", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
				minimal: false,
			});

			// Set up spies for both methods
			const getScreenshotSpy = sinon
				.stub(reporter as any, "getScreenshot")
				.returns("base64-screenshot-data");

			const mockAttachments = [
				{
					name: "video",
					contentType: "video/mp4",
					path: "/path/to/video.mp4",
				},
			];

			const getAttachmentsSpy = sinon
				.stub(reporter as any, "getAttachments")
				.returns(mockAttachments);

			const mockTest: CypressTest = {
				title: ["Test", "With Attachments"],
				state: "passed",
			};

			const mockResults = {
				tests: [mockTest],
				screenshots: [{ path: "/path/to/screenshot1.png" }],
				video: "/path/to/video.mp4",
			};

			(reporter as any).updateCtrfResultsFromAfterSpecResults(mockResults);

			// Verify methods were called
			sinon.assert.called(getScreenshotSpy);
			sinon.assert.called(getAttachmentsSpy);

			const updatedTestResult = reporter.ctrfReport.results.tests[0];
			expect(updatedTestResult.screenshot).toBe("base64-screenshot-data");
			expect(updatedTestResult.attachments).toEqual(mockAttachments);

			// Clean up
			getScreenshotSpy.restore();
			getAttachmentsSpy.restore();
		});
	});

	describe("updateCtrfTotalFromAfterRun", () => {
		it("should update the total tests count", () => {
			const mockRun: CypressAfterRun = {
				totalTests: 1,
				totalPassed: 1,
				totalFailed: 0,
				totalSkipped: 0,
				totalPending: 0,
				totalSuites: 0,
			};

			(reporter as any).updateCtrfTotalsFromAfterRun(mockRun);

			expect(reporter.ctrfReport.results.summary.tests).toBe(
				mockRun.totalTests,
			);
		});

		for (const [status, passed, failed, skipped, pending] of [
			["passed", 1, 0, 0, 0],
			["failed", 0, 1, 0, 0],
			["skipped", 0, 0, 1, 0],
			["pending", 0, 0, 0, 1],
		] as const) {
			it(`should update for status ${status}`, () => {
				const mockRun: CypressAfterRun = {
					totalTests: 1,
					totalPassed: passed,
					totalFailed: failed,
					totalSkipped: skipped,
					totalPending: pending,
					totalSuites: 0,
				};

				(reporter as any).updateCtrfTotalsFromAfterRun(mockRun);

				expect(reporter.ctrfReport.results.summary.passed).toBe(passed);
				expect(reporter.ctrfReport.results.summary.failed).toBe(failed);
				expect(reporter.ctrfReport.results.summary.skipped).toBe(skipped);
				expect(reporter.ctrfReport.results.summary.pending).toBe(pending);
			});
		}
	});

	describe("getScreenshot", () => {
		beforeEach(() => {
			readFileSyncStub.resetHistory();
			readFileSyncStub.callsFake((path: string) => `base64-encoded-${path}`);
		});

		it("should return undefined when screenshot option is false", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: false,
			});

			const test: CypressTest = {
				title: ["Test", "With Screenshot"],
				state: "passed",
			};

			const results = {
				screenshots: [{ path: "/path/to/Test -- With Screenshot.png" }],
			};

			const screenshot = (reporter as any).getScreenshot(test, results);
			expect(screenshot).toBeUndefined();
		});

		it("should return the failed screenshot when available", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});

			const test: CypressTest = {
				title: ["Test", "With Failed Screenshot"],
				state: "failed",
			};

			const results = {
				screenshots: [
					{ path: "/path/to/Test -- With Failed Screenshot (failed).png" },
				],
			};

			const screenshot = (reporter as any).getScreenshot(test, results);
			expect(screenshot).toBe(
				"base64-encoded-/path/to/Test -- With Failed Screenshot (failed).png",
			);
			sinon.assert.calledWith(
				readFileSyncStub,
				"/path/to/Test -- With Failed Screenshot (failed).png",
				{ encoding: "base64" },
			);
		});

		it("should return the last screenshot when multiple exist for the same test", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test", "With Multiple Screenshots"],
				state: "passed",
			};

			const results = {
				screenshots: [
					{ path: "/path/to/Test -- With Multiple Screenshots (1).png" },
					{ path: "/path/to/Test -- With Multiple Screenshots (2).png" },
					{ path: "/path/to/Test -- With Multiple Screenshots (3).png" },
				],
			};

			const screenshot = (reporter as any).getScreenshot(test, results);
			expect(screenshot).toBe(
				"base64-encoded-/path/to/Test -- With Multiple Screenshots (3).png",
			);
			sinon.assert.calledWith(
				readFileSyncStub,
				"/path/to/Test -- With Multiple Screenshots (3).png",
				{ encoding: "base64" },
			);
		});

		it("should prioritize failed screenshot when both failed and normal screenshots exist", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test", "With Both Types"],
				state: "failed",
			};

			const results = {
				screenshots: [
					{ path: "/path/to/Test -- With Both Types (1).png" },
					{ path: "/path/to/Test -- With Both Types (failed).png" },
					{ path: "/path/to/Test -- With Both Types (2).png" },
				],
			};

			const screenshot = (reporter as any).getScreenshot(test, results);
			expect(screenshot).toBe(
				"base64-encoded-/path/to/Test -- With Both Types (failed).png",
			);
			sinon.assert.calledWith(
				readFileSyncStub,
				"/path/to/Test -- With Both Types (failed).png",
				{ encoding: "base64" },
			);
		});

		it("should return undefined when no screenshots match the test", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test", "With No Matching Screenshots"],
				state: "passed",
			};

			const results = {
				screenshots: [
					{ path: "/path/to/Different -- Test.png" },
					{ path: "/path/to/Another -- Different -- Test.png" },
				],
			};

			const screenshot = (reporter as any).getScreenshot(test, results);
			expect(screenshot).toBeUndefined();
			sinon.assert.notCalled(readFileSyncStub);
		});

		it("should return undefined when screenshots array is empty", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test"],
				state: "passed",
			};

			const results = {
				screenshots: [],
			};

			const screenshot = (reporter as any).getScreenshot(test, results);
			expect(screenshot).toBeUndefined();
			sinon.assert.notCalled(readFileSyncStub);
		});

		it("should return undefined when screenshots is undefined", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test"],
				state: "passed",
			};

			const results = {};

			const screenshot = (reporter as any).getScreenshot(test, results);
			expect(screenshot).toBeUndefined();
			sinon.assert.notCalled(readFileSyncStub);
		});

		it("should handle empty paths in screenshots array", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test", "With Empty Path"],
				state: "passed",
			};

			const results = {
				screenshots: [
					{ path: "" },
					{ path: "/path/to/Test -- With Empty Path.png" },
				],
			};

			const screenshot = (reporter as any).getScreenshot(test, results);
			expect(screenshot).toBe(
				"base64-encoded-/path/to/Test -- With Empty Path.png",
			);
			sinon.assert.calledWith(
				readFileSyncStub,
				"/path/to/Test -- With Empty Path.png",
				{ encoding: "base64" },
			);
		});

		it("should return an array of CtrfAttachment objects when attachment parameter is true", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test", "With Attachment Parameter"],
				state: "passed",
			};

			const results = {
				screenshots: [
					{ path: "/path/to/Test -- With Attachment Parameter.png" },
				],
			};

			const attachments = (reporter as any).getScreenshot(test, results, true);
			expect(Array.isArray(attachments)).toBe(true);
			expect(attachments).toHaveLength(1);
			expect(attachments[0]).toEqual({
				name: "screenshot",
				contentType: "image/png",
				path: "/path/to/Test -- With Attachment Parameter.png",
			});
			// Should not read file content for attachment mode
			sinon.assert.notCalled(readFileSyncStub);
		});

		it("should return all matching screenshots as CtrfAttachment[] when attachment parameter is true", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test", "Multiple Screenshots"],
				state: "passed",
			};

			const results = {
				screenshots: [
					{ path: "/path/to/Test -- Multiple Screenshots (1).png" },
					{ path: "/path/to/Test -- Multiple Screenshots (2).png" },
					{ path: "/path/to/Test -- Multiple Screenshots (failed).png" },
					{ path: "/path/to/Another Test.png" }, // Should not be included
				],
			};

			const attachments = (reporter as any).getScreenshot(test, results, true);
			expect(Array.isArray(attachments)).toBe(true);
			expect(attachments).toHaveLength(3); // Only the matching screenshots

			// Verify each attachment has the correct format
			attachments.forEach((attachment: Attachment) => {
				expect(attachment).toHaveProperty("name", "screenshot");
				expect(attachment).toHaveProperty("contentType", "image/png");
				expect(attachment.path).toContain("Test -- Multiple Screenshots");
			});

			// Verify no file reading occurred
			sinon.assert.notCalled(readFileSyncStub);
		});

		it("should return a string when attachment parameter is false", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test", "String Return"],
				state: "passed",
			};

			const results = {
				screenshots: [{ path: "/path/to/Test -- String Return.png" }],
			};

			const result = (reporter as any).getScreenshot(test, results, false);
			expect(typeof result).toBe("string");
			expect(result).toBe("base64-encoded-/path/to/Test -- String Return.png");
			sinon.assert.calledWith(
				readFileSyncStub,
				"/path/to/Test -- String Return.png",
				{ encoding: "base64" },
			);
		});

		it("should return undefined when attachment is true but no screenshots match", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test", "With No Matching Screenshots"],
				state: "passed",
			};

			const results = {
				screenshots: [
					{ path: "/path/to/Different -- Test.png" },
					{ path: "/path/to/Another -- Different -- Test.png" },
				],
			};

			const attachments = (reporter as any).getScreenshot(test, results, true);
			expect(attachments).toBeUndefined();
			sinon.assert.notCalled(readFileSyncStub);
		});

		it("should filter out empty paths when attachment is true", () => {
			reporter = new GenerateCtrfReport({
				on: mockOn,
				screenshot: true,
			});
			const test: CypressTest = {
				title: ["Test", "With Empty Path"],
				state: "passed",
			};

			const results = {
				screenshots: [
					{ path: "" },
					{ path: "/path/to/Test -- With Empty Path.png" },
				],
			};

			const attachments = (reporter as any).getScreenshot(test, results, true);
			expect(Array.isArray(attachments)).toBe(true);
			expect(attachments).toHaveLength(1);
			expect(attachments[0]).toEqual({
				name: "screenshot",
				contentType: "image/png",
				path: "/path/to/Test -- With Empty Path.png",
			});
			sinon.assert.notCalled(readFileSyncStub);
		});
	});
});
