export { GenerateCtrfReport } from './generate-report'

// Runtime API exports (Node-safe)
export { ctrf, extra, type CtrfCypressMessage } from './runtime'
export { setupCtrfPlugin, getCtrfRuntimeStore, CTRF_TASK_NAME } from './plugin'

// Note: './support' is browser-only and should be imported directly in support files
// via: import 'cypress-ctrf-json-reporter/support'
