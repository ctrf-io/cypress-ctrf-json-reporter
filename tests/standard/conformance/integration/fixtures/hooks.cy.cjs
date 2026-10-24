describe("hook failure", () => {
	beforeEach(() => {
		throw new Error("fixture hook failure");
	});
	it("unreached", () => {});
	it("skipped after hook", () => {});
});
describe("timeout", () => {
	it("times out", { retries: 0 }, () => {
		cy.then({ timeout: 30 }, () => new Cypress.Promise(() => {}));
	});
});
