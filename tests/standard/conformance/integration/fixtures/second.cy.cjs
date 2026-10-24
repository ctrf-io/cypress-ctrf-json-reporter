const { ctrf } = require("cypress-ctrf-json-reporter/runtime");
describe("second file", () => {
	it("pass", function () {
		const extra = { file: "second" };
		ctrf.extra(extra);
		cy.task("__native_fixture", {
			spec: Cypress.spec.relative,
			title: this.test.titlePath(),
			attempt: this.test.currentRetry(),
			extra,
			browser: Cypress.browser,
		});
	});
});
