/**
 * CTRF Cypress Node Plugin
 *
 * This module runs in the Cypress node process and:
 * 1. Registers a task handler to receive runtime messages from browser
 * 2. Stores runtime metadata keyed by test identity
 * 3. Provides access to stored data for the reporter to merge
 *
 * ## Setup
 *
 * In your cypress.config.ts:
 * ```ts
 * import { setupCtrfPlugin, getCtrfRuntimeStore } from 'cypress-ctrf-json-reporter/plugin'
 *
 * export default defineConfig({
 *   e2e: {
 *     setupNodeEvents(on, config) {
 *       setupCtrfPlugin(on)
 *       // ... other plugins
 *       return config
 *     }
 *   }
 * })
 * ```
 */

import type { CtrfCypressMessage } from './runtime'

// Type for Cypress plugin events (minimal subset we need)
type CypressPluginEvents = {
  (action: 'task', tasks: Record<string, (...args: any[]) => any>): void
}

// Task name - must match the browser adapter
export const CTRF_TASK_NAME = '__ctrf_runtime_message'

/**
 * Runtime data stored per test attempt
 */
interface StoredTestData {
  messages: CtrfCypressMessage[]
  merged: Record<string, unknown>
}

/**
 * Store for runtime data, keyed by testKey (specRel::fullTitle::attemptIndex)
 */
class CtrfRuntimeStore {
  private data = new Map<string, StoredTestData>()

  /**
   * Store a runtime message for a test
   */
  addMessage(message: CtrfCypressMessage): void {
    const existing = this.data.get(message.testKey)
    if (existing) {
      existing.messages.push(message)
      // Deep merge into accumulated data
      existing.merged = this.deepMerge(
        existing.merged as Record<string, unknown>,
        message.data as Record<string, unknown>
      )
    } else {
      this.data.set(message.testKey, {
        messages: [message],
        merged: { ...message.data },
      })
    }
  }

  /**
   * Deep merge two objects following CTRF merge rules:
   * - Arrays: concatenated
   * - Objects: recursively merged
   * - Primitives: overwritten
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target }

    for (const [key, sourceValue] of Object.entries(source)) {
      const targetValue = result[key]

      if (Array.isArray(sourceValue)) {
        result[key] = Array.isArray(targetValue)
          ? [...targetValue, ...sourceValue]
          : [...sourceValue]
      } else if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue)
      ) {
        result[key] =
          targetValue !== null &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
            ? this.deepMerge(
                targetValue as Record<string, unknown>,
                sourceValue as Record<string, unknown>
              )
            : { ...sourceValue }
      } else {
        result[key] = sourceValue
      }
    }

    return result
  }

  /**
   * Get merged runtime data for a test key
   */
  getMerged(testKey: string): Record<string, unknown> | null {
    const stored = this.data.get(testKey)
    return stored?.merged ?? null
  }

  /**
   * Get merged runtime data by matching spec and test title
   * This is used by the reporter which has spec.relative and test.title array
   */
  getByTestIdentity(
    specRelative: string,
    titleArray: string[],
    attemptIndex: number
  ): Record<string, unknown> | null {
    const fullTitle = titleArray.join(' ')
    const testKey = `${specRelative}::${fullTitle}::${attemptIndex}`
    return this.getMerged(testKey)
  }

  /**
   * Clear all stored data for a spec (called after spec completes)
   */
  clearSpec(specRelative: string): void {
    for (const key of this.data.keys()) {
      if (key.startsWith(`${specRelative}::`)) {
        this.data.delete(key)
      }
    }
  }

  /**
   * Clear all stored data (called at end of run)
   */
  clearAll(): void {
    this.data.clear()
  }

  /**
   * Get all keys (for debugging)
   */
  getAllKeys(): string[] {
    return Array.from(this.data.keys())
  }
}

// Singleton store instance
const runtimeStore = new CtrfRuntimeStore()

/**
 * Get the runtime store instance (for use by reporter)
 */
export function getCtrfRuntimeStore(): CtrfRuntimeStore {
  return runtimeStore
}

/**
 * Setup the CTRF plugin in Cypress node events.
 *
 * @param on - The Cypress `on` function from setupNodeEvents
 *
 * @example
 * ```ts
 * setupNodeEvents(on, config) {
 *   setupCtrfPlugin(on)
 *   return config
 * }
 * ```
 */
export function setupCtrfPlugin(on: CypressPluginEvents): void {
  // Register task handler to receive messages from browser
  on('task', {
    [CTRF_TASK_NAME](messages: CtrfCypressMessage[]) {
      for (const message of messages) {
        runtimeStore.addMessage(message)
      }
      // Must return a value (not undefined) for cy.task
      return null
    },
  })
}

/**
 * Create a combined plugin setup that includes the CTRF reporter.
 * Use this if you want an all-in-one setup.
 *
 * @param on - The Cypress `on` function
 * @param reporterOptions - Options for the CTRF reporter
 */
export function setupCtrfReporterWithRuntime(
  on: CypressPluginEvents,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reporterOptions: Record<string, unknown> = {}
): void {
  // Setup the runtime plugin first
  setupCtrfPlugin(on)

  // The reporter will be set up separately and will use getCtrfRuntimeStore()
  // to access the runtime data
}
