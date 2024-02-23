import fs = require('fs')
import path = require('path')

import {
  type CtrfEnvironment,
  type CtrfReport,
  type CtrfTest,
} from '../types/ctrf'
import {
  type TestAttempt,
  type CypressAfterRun,
  type CypressAfterSpecResults,
  type CypressAfterSpecSpec,
  type CypressTest,
  type Config,
} from '../types/cypress'

interface ReporterConfigOptions {
  on: any
  outputFile?: string
  outputDir?: string
  minimal?: boolean
  screenshot?: boolean
  testType?: string
  appName?: string | undefined
  appVersion?: string | undefined
  osPlatform?: string | undefined
  osRelease?: string | undefined
  osVersion?: string | undefined
  buildName?: string | undefined
  buildNumber?: string | undefined
}

export class GenerateCtrfReport {
  private readonly ctrfReport: CtrfReport
  readonly ctrfEnvironment: CtrfEnvironment
  readonly reporterConfigOptions: ReporterConfigOptions
  readonly reporterName = 'cypress-ctrf-json-reporter'
  readonly defaultOutputFile = 'ctrf-report.json'
  readonly defaultOutputDir = 'ctrf'
  runStart = 0
  runStop = 0
  filename = this.defaultOutputFile
  browser = ''

  constructor(reporterOptions: ReporterConfigOptions) {
    this.reporterConfigOptions = {
      on: reporterOptions.on,
      outputFile: reporterOptions?.outputFile ?? this.defaultOutputFile,
      outputDir: reporterOptions?.outputDir ?? this.defaultOutputDir,
      minimal: reporterOptions?.minimal ?? false,
      testType: reporterOptions?.testType ?? 'e2e',
      appName: reporterOptions?.appName ?? undefined,
      appVersion: reporterOptions?.appVersion ?? undefined,
      osPlatform: reporterOptions?.osPlatform ?? undefined,
      osRelease: reporterOptions?.osRelease ?? undefined,
      osVersion: reporterOptions?.osVersion ?? undefined,
      buildName: reporterOptions?.buildName ?? undefined,
      buildNumber: reporterOptions?.buildNumber ?? undefined,
    }
    this.ctrfReport = {
      results: {
        tool: {
          name: 'cypress',
        },
        summary: {
          tests: 0,
          passed: 0,
          failed: 0,
          pending: 0,
          skipped: 0,
          other: 0,
          start: 0,
          stop: 0,
        },
        tests: [],
      },
    }
    this.validateOptions()

    if (this.reporterConfigOptions.outputFile !== undefined)
      this.setFilename(this.reporterConfigOptions.outputFile)

    this.ctrfEnvironment = {}

    if (this.reporterConfigOptions?.outputFile !== undefined)
      this.setFilename(this.reporterConfigOptions.outputFile)

    if (
      !fs.existsSync(
        this.reporterConfigOptions.outputDir ?? this.defaultOutputDir
      )
    ) {
      fs.mkdirSync(
        this.reporterConfigOptions.outputDir ?? this.defaultOutputDir,
        { recursive: true }
      )
    }

    this.setEventHandlers()
  }

  private setFilename(filename: string): void {
    if (filename.endsWith('.json')) {
      this.filename = filename
    } else {
      this.filename = `${filename}.json`
    }
  }

  private validateOptions(): void {
    if (this.reporterConfigOptions.on === false) {
      throw new Error('Missing required option: on')
    }
  }

  private setEventHandlers(): void {
    this.reporterConfigOptions.on('before:run', (config: Config) => {
      this.runStart = Date.now()
      this.browser = `${config.browser.name} ${config.browser.version}`
      this.setEnvironmentDetails(this.reporterConfigOptions ?? {})
      if (this.hasEnvironmentDetails(this.ctrfEnvironment)) {
        this.ctrfReport.results.environment = this.ctrfEnvironment
      }
    })

    this.reporterConfigOptions.on(
      'after:spec',
      (_spec: CypressAfterSpecSpec, results: CypressAfterSpecResults) => {
        fs.writeFileSync('after-spec-results', JSON.stringify(results))
        fs.writeFileSync('after-spec', JSON.stringify(_spec))

        this.updateCtrfResultsFromAfterSpecResults(results)
      }
    )

    this.reporterConfigOptions.on('after:run', (run: CypressAfterRun) => {
      this.runStop = Date.now()
      this.updateCtrfTotalsFromAfterRun(run)
      this.writeReportToFile(this.ctrfReport)
    })
  }

  private updateCtrfResultsFromAfterSpecResults(
    cypressResults: CypressAfterSpecResults
  ): void {
    cypressResults.tests.forEach((test: CypressTest) => {
      const latestAttempt = test.attempts?.[test.attempts.length - 1]
      const durationValue =
        typeof test.duration === 'number'
          ? test.duration
          : latestAttempt?.wallClockDuration ?? 0
      const attemptsLength = test.attempts?.length ?? 0
      const isFlaky = test.state === 'passed' && attemptsLength > 1

      const ctrfTest: CtrfTest = {
        name: test.title.join(' '),
        status: test.state,
        duration: durationValue,
      }

      if (this.reporterConfigOptions.minimal === false) {
        if (test.state === 'failed') {
          const failureDetails = this.extractFailureDetails(test, latestAttempt)
          ctrfTest.message = failureDetails.message
          ctrfTest.trace = failureDetails.trace
        }
        ctrfTest.rawStatus = test.state
        ctrfTest.type = this.reporterConfigOptions.testType ?? 'e2e'
        ctrfTest.filePath = cypressResults.spec?.relative
        ctrfTest.retry = attemptsLength - 1
        ctrfTest.flake = isFlaky
        ctrfTest.browser = this.browser
      }
      this.ctrfReport.results.tests.push(ctrfTest)
    })
  }

  private updateCtrfTotalsFromAfterRun(run: CypressAfterRun): void {
    this.ctrfReport.results.summary = {
      tests: run.totalTests,
      failed: run.totalFailed,
      passed: run.totalPassed,
      skipped: run.totalSkipped,
      pending: run.totalPending,
      other: 0,
      start: this.runStart,
      stop: this.runStop,
    }
  }

  setEnvironmentDetails(reporterConfigOptions: ReporterConfigOptions): void {
    if (reporterConfigOptions.appName !== undefined) {
      this.ctrfEnvironment.appName = reporterConfigOptions.appName
    }
    if (reporterConfigOptions.appVersion !== undefined) {
      this.ctrfEnvironment.appVersion = reporterConfigOptions.appVersion
    }
    if (reporterConfigOptions.osPlatform !== undefined) {
      this.ctrfEnvironment.osPlatform = reporterConfigOptions.osPlatform
    }
    if (reporterConfigOptions.osRelease !== undefined) {
      this.ctrfEnvironment.osRelease = reporterConfigOptions.osRelease
    }
    if (reporterConfigOptions.osVersion !== undefined) {
      this.ctrfEnvironment.osVersion = reporterConfigOptions.osVersion
    }
    if (reporterConfigOptions.buildName !== undefined) {
      this.ctrfEnvironment.buildName = reporterConfigOptions.buildName
    }
    if (reporterConfigOptions.buildNumber !== undefined) {
      this.ctrfEnvironment.buildNumber = reporterConfigOptions.buildNumber
    }
  }

  hasEnvironmentDetails(environment: CtrfEnvironment): boolean {
    return Object.keys(environment).length > 0
  }

  extractFailureDetails(
    testResult: CypressTest,
    lastAttempt?: TestAttempt
  ): Partial<CtrfTest> {
    const failureDetails: Partial<CtrfTest> = {}

    if (
      lastAttempt?.error !== undefined &&
      'message' in lastAttempt.error &&
      'stack' in lastAttempt.error
    ) {
      failureDetails.message = lastAttempt.error.message
      failureDetails.trace = lastAttempt.error.stack
    } else if (
      typeof testResult.displayError === 'string' &&
      testResult.displayError.trim().length > 0
    ) {
      failureDetails.message = testResult.displayError
      failureDetails.trace = testResult.displayError
    }

    return failureDetails
  }

  private writeReportToFile(data: CtrfReport): void {
    const filePath = path.join(
      this.reporterConfigOptions.outputDir ?? this.defaultOutputDir,
      this.reporterConfigOptions.outputFile ?? this.defaultOutputFile
    )
    const str = JSON.stringify(data, null, 2)
    try {
      fs.writeFileSync(filePath, str + '\n')
      console.log(
        `${this.reporterName}: successfully written ctrf json to %s/%s`,
        this.reporterConfigOptions.outputDir,
        this.reporterConfigOptions.outputFile
      )
    } catch (error) {
      console.error(`Error writing ctrf json report:, ${String(error)}`)
    }
  }
}
