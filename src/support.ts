/**
 * CTRF Cypress Browser Adapter
 *
 * This module runs in the Cypress browser context (loaded via support file).
 * It sets up the transport that routes runtime API calls to the node plugin
 * via cy.task().
 *
 * ## Setup
 *
 * In your cypress/support/e2e.ts (or e2e.js):
 * ```ts
 * import 'cypress-ctrf-json-reporter/support'
 *
 * // Re-export for test files to import from the same module instance
 * export { ctrf } from 'cypress-ctrf-json-reporter/runtime'
 * ```
 *
 * Then in test files:
 * ```ts
 * import { ctrf } from '../support/e2e'
 *
 * it('my test', () => {
 *   ctrf.extra({ owner: 'my-team' })
 * })
 * ```
 *
 * IMPORTANT: Test files must import `ctrf` from your support file's re-export,
 * NOT directly from the runtime module. This ensures the transport is registered
 * before any runtime calls are made.
 *
 * This automatically:
 * 1. Registers the transport for the runtime API
 * 2. Ensures cy.task calls are properly queued
 */

// Declare Cypress globals (actual globals exist at runtime in browser context)
declare const cy: any
declare function afterEach(fn: () => void): void

import { __registerTransport, type CtrfCypressMessage } from './runtime'
import { CTRF_TASK_NAME } from './plugin'

/**
 * Queue of messages to send - batched for efficiency
 */
let messageQueue: CtrfCypressMessage[] = []
let flushScheduled = false

/**
 * Flush queued messages to the node plugin via cy.task
 */
function flushMessages(): void {
  if (messageQueue.length === 0) {
    flushScheduled = false
    return
  }

  const messages = messageQueue
  messageQueue = []
  flushScheduled = false

  // Use cy.task to send to node - this is properly queued in Cypress command chain
  cy.task(CTRF_TASK_NAME, messages, { log: false })
}

/**
 * Browser-side transport that queues messages and sends via cy.task
 */
const cypressTransport = {
  send(message: CtrfCypressMessage): void {
    messageQueue.push(message)

    // Schedule flush on next tick to batch multiple calls
    if (!flushScheduled) {
      flushScheduled = true
      // Use Cypress's then() to ensure we're in the command queue
      cy.then(() => {
        flushMessages()
      })
    }
  },
}

// Register the transport when this module loads
__registerTransport(cypressTransport)

// Also flush any remaining messages after each test
afterEach(() => {
  if (messageQueue.length > 0) {
    flushMessages()
  }
})
