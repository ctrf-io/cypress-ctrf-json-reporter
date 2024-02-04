// see https://docs.cypress.io/api/plugins/after-spec-api#Syntax
export interface CypressAfterSpecSpec {
  absolute: string
  fileExtension: string
  fileName: string
  name: string
  relative: string
}

// see https://docs.cypress.io/api/plugins/after-spec-api#Syntax
export interface CypressAfterSpecResults {
  tests: CypressTest[]
  spec?: CypressAfterSpecSpec
  error?: any
  reporter?: string
  reporterStats?: Stats
  screenshots?: Screenshot[]
  stats?: Stats
  video?: string | null
}

// see https://docs.cypress.io/api/plugins/after-run-api#Syntax
interface CypressAfterRun {
  browserName?: string
  browserPath?: string
  browserVersion?: string
  config?: Config
  cypressVersion?: string
  endedTestsAt?: string
  osName?: string
  osVersion?: string
  runs?: CypressAfterSpecResults[]
  startedTestsAt?: string
  totalDuration?: number
  totalFailed: number
  totalPassed: number
  totalPending: number
  totalSkipped: number
  totalSuites: number
  totalTests: number
}

export type CypressTestState = 'passed' | 'failed' | 'pending' | 'skipped'

export interface Stats {
  suites: number
  tests: number
  passes: number
  pending: number
  failures: number
  start: string
  end: string
  duration: number
}

export interface Screenshot {
  height: number
  name: string | null
  path: string
  takenAt: string
  width: number
}

export interface ReporterStats {
  duration: number
  endedAt: string
  failures: number
  passes: number
  pending: number
  skipped: number
  startedAt: string
  suites: number
  tests: number
}

export interface TestAttempt {
  state: CypressTestState
  error?: CypressTestError
  wallClockDuration?: number
}

export interface CypressTestError {
  message: string
  stack: string
}

export interface CypressTest {
  attempts?: TestAttempt[]
  displayError?: string | null
  duration?: number
  state: CypressTestState
  title: string[]
}

interface BrowserInfo {
  channel: string
  displayName: string
  family: string
  majorVersion: string | number
  name: string
  path: string
  version: string
}

interface Config {
  projectRoot: string
  projectName: string
  configFile: string
  isTextTerminal: boolean
  animationDistanceThreshold: number
  arch: string
  baseUrl: string | null
  blockHosts: string[] | null
  chromeWebSecurity: boolean
  clientCertificates: any[]
  defaultCommandTimeout: number
  downloadsFolder: string
  env: Record<string, any>
  execTimeout: number
  experimentalCspAllowList: boolean
  experimentalFetchPolyfill: boolean
  browsers: BrowserInfo[]
  cypressBinaryRoot: string
  hosts: any[] | null
  isInteractive: boolean
  version: string
  testingType: string
  browser: any | null
  cypressInternalEnv: string
}
