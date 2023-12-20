import fs = require('fs')
import path = require('path')

import {
  type CtrfEnvironment,
  type CtrfReport,
  type CtrfTest,
} from '../types/ctrf'
import {
  type CypressAfterRun,
  type CypressAfterSpecResults,
  type CypressAfterSpecSpec,
  type CypressTest,
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

  constructor(reporterOptions: ReporterConfigOptions) {
    this.reporterConfigOptions = {
      on: reporterOptions.on,
      outputFile: reporterOptions?.outputFile ?? this.defaultOutputFile,
      outputDir: reporterOptions?.outputDir ?? this.defaultOutputDir,
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
    this.reporterConfigOptions.on('before:run', () => {
      this.runStart = Date.now()
      this.setEnvironmentDetails(this.reporterConfigOptions ?? {})
      if (this.hasEnvironmentDetails(this.ctrfEnvironment)) {
        this.ctrfReport.results.environment = this.ctrfEnvironment
      }
    })

    this.reporterConfigOptions.on(
      'after:spec',
      (_spec: CypressAfterSpecSpec, results: CypressAfterSpecResults) => {
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
    cypressResults.tests.forEach((t: CypressTest) => {
      const durationValue =
        typeof t.duration === 'number'
          ? t.duration
          : t.attempts?.[t.attempts.length - 1]?.wallClockDuration ?? 0

      const test: CtrfTest = {
        name: t.title.join(' '),
        status: t.state,
        duration: durationValue,
      }

      this.ctrfReport.results.tests.push(test)
    })
  }

  private updateCtrfTotalsFromAfterRun(run: CypressAfterRun): void {
    this.ctrfReport.results.summary = {
      suites: run.totalSuites,
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
