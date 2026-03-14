/**
 * CTRF Runtime API for Cypress
 *
 * Enables enriching CTRF test reports with custom metadata at runtime.
 * Metadata is collected via cy.task and consolidated by the reporter
 * into the test's `extra` field.
 *
 * ## Usage
 *
 * ```ts
 * import { ctrf } from 'cypress-ctrf-json-reporter/runtime'
 *
 * it('checkout flow', () => {
 *   ctrf.extra({ owner: 'checkout-team', priority: 'P1' })
 *   // ... test code
 *   ctrf.extra({ customMetric: 'value' })
 * })
 * ```
 *
 * ## API
 *
 * - `ctrf.extra(data)` - Attach key-value metadata to the current test
 *
 * ## Behavior
 *
 * - Call multiple times; all data is collected and merged
 * - Works from any function in the call stack during test execution
 * - Silently ignored when called outside test context
 * - Deep merge: arrays concatenated, objects recursively merged, primitives overwritten
 */

// Declare Cypress global for type checking (actual global exists at runtime)
declare const Cypress: any

/**
 * Runtime message format sent from browser to node plugin.
 */
export interface CtrfCypressMessage {
  type: 'metadata'
  testKey: string
  data: Record<string, unknown>
}

/**
 * Transport interface for sending metadata to the node plugin.
 * The browser adapter will set this up.
 */
export interface CtrfTransport {
  send(message: CtrfCypressMessage): void
}

// Global transport - set by the browser adapter
let activeTransport: CtrfTransport | null = null

/**
 * Register a transport (called by the browser adapter during Cypress setup).
 * @internal
 */
export function __registerTransport(transport: CtrfTransport): void {
  activeTransport = transport
}

/**
 * Unregister the transport (for cleanup/testing).
 * @internal
 */
export function __clearTransport(): void {
  activeTransport = null
}

/**
 * Get the current test key from Mocha/Cypress context.
 * Returns null if not in a test context.
 * @internal
 */
export function __getCurrentTestKey(): string | null {
  // This will be called from browser context where Cypress/Mocha globals exist
  if (typeof Cypress === 'undefined') {
    return null
  }

  try {
    // Get current test from Mocha's context
    const currentTest = (Cypress as any).mocha?.getRunner()?.currentRunnable
    if (!currentTest || currentTest.type !== 'test') {
      return null
    }

    // Build the full title array (same as Cypress after:spec provides)
    const titlePath: string[] = []
    let runnable = currentTest
    while (runnable) {
      if (runnable.title) {
        titlePath.unshift(runnable.title)
      }
      runnable = runnable.parent
    }

    // Get spec path
    const spec = Cypress.spec
    const specRel = spec?.relative || spec?.name || 'unknown'

    // Get current attempt (retry) index
    const attemptIndex = (currentTest as any)._currentRetry ?? 0

    // Build deterministic key: specRel::fullTitle::attemptIndex
    const fullTitle = titlePath.join(' ')
    return `${specRel}::${fullTitle}::${attemptIndex}`
  } catch {
    return null
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Public API
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Attach custom metadata to the current test.
 *
 * @param data - Key-value pairs to include in the CTRF report's `extra` field
 *
 * @remarks
 * - Multiple calls accumulate; data is deep-merged (arrays concatenated, objects recursed, primitives overwritten)
 * - Safe to call from helper functions - binds to the active test automatically
 * - No-op outside test context (e.g., in hooks without a test)
 *
 * @example
 * ctrf.extra({ owner: 'platform-team' })
 * ctrf.extra({ executionId: 'abc123', retryable: true })
 */
export function extra(data: Record<string, unknown>): void {
  if (!activeTransport) {
    // No transport registered - silently ignore (might be imported outside Cypress)
    return
  }

  const testKey = __getCurrentTestKey()
  if (!testKey) {
    // Not in a test context - silently ignore
    return
  }

  activeTransport.send({
    type: 'metadata',
    testKey,
    data,
  })
}

/** CTRF runtime API namespace */
export const ctrf = { extra } as const
