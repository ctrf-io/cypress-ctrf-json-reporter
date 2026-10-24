const { ctrf } = require("cypress-ctrf-json-reporter");
const mode = Cypress.expose("fixtureMode");
function source(test, extra) {
	cy.task("__native_fixture", {
		spec: Cypress.spec.relative,
		title: test.titlePath(),
		attempt: test.currentRetry(),
		extra,
		browser: Cypress.browser,
	});
}
describe("suite", () => {
	if (mode === "all-skipped") {
		it.skip("skip", () => {});
		it("pending");
		return;
	}
	it("pass", function () {
		const extra = {
			owner: "last",
			nested: { a: 1, b: 2 },
			list: ["one", "two"],
		};
		ctrf.extra({ owner: "first", nested: { a: 1 }, list: ["one"] });
		ctrf.extra({ owner: "last", nested: { b: 2 }, list: ["two"] });
		source(this.test, extra);
		cy.document().then((doc) => {
			doc.body.innerHTML = "<h1>CTRF fixture</h1>";
		});
		cy.screenshot({ capture: "viewport" });
	});
	it("isolated", function () {
		ctrf.extra({ isolated: true });
		source(this.test, { isolated: true });
	});
	it("unicode ✓", () => {
		expect(1).to.equal(1);
	});
	describe("first", () => {
		it("duplicate", () => {});
	});
	describe("second", () => {
		it("duplicate", () => {});
	});
	if (mode === "mixed") {
		it.skip("skip", () => {});
		it("pending");
		it("flaky", { retries: 1 }, function () {
			ctrf.extra({ attempt: this.test.currentRetry() });
			source(this.test, { attempt: this.test.currentRetry() });
			const attempt = this.test.currentRetry();
			cy.then(() => expect(attempt).to.equal(1));
		});
		it("failure", { retries: 2 }, () => {
			cy.then(() => {
				throw new Error("fixture failure");
			});
		});
	}
});
