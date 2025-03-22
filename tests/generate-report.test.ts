import { GenerateCtrfReport } from '../src/generate-report'
import {
  CypressAfterRun,
  CypressTest,
  CypressTestState,
} from '../types/cypress'

const fs = require('fs')

jest.mock('fs')

describe('GenerateCtrfReport', () => {
  let reporter: GenerateCtrfReport
  let mockOn: jest.Mock

  beforeEach(() => {
    mockOn = jest.fn()
    reporter = new GenerateCtrfReport({ on: mockOn })
    fs.writeFileSync.mockClear()
  })

  describe('Validation and events', () => {
    it('should register listeners for after:spec', () => {
      expect(mockOn).toHaveBeenCalledWith('after:spec', expect.any(Function))
    })

    it('should register listeners for after:run events', () => {
      expect(mockOn).toHaveBeenCalledWith('after:run', expect.any(Function))
    })
  })

  describe('Set config options', () => {
    describe('filename', () => {
      it('should set filename from if present in options', () => {
        const filenameOption = 'custom-filename.json'
        const reporterWithFilename = new GenerateCtrfReport({
          on: mockOn,
          outputFile: filenameOption,
        })
        expect((reporterWithFilename as any).filename).toEqual(filenameOption)
      })

      it('should use default filename if filename is not present in options', () => {
        expect((reporter as any).outputFile).toEqual(
          (reporter as any).defaultFilename
        )
      })
    })

    describe('setFilename', () => {
      it('should add .json extension if none provided', () => {
        ;(reporter as any).setFilename('custom-filename')
        expect((reporter as any).filename).toBe('custom-filename.json')
      })

      it('should keep .json extension if already provided', () => {
        ;(reporter as any).setFilename('custom-filename.json')
        expect((reporter as any).filename).toBe('custom-filename.json')
      })

      it('should append .json to any other extensions', () => {
        ;(reporter as any).setFilename('custom-filename.txt')
        expect((reporter as any).filename).toBe('custom-filename.txt.json')
      })
    })
  })

  describe('updateCtrfResultsFromAfterSpecResults', () => {
    it('should update the ctrfReport with required test properties', () => {
      const mockTest: CypressTest = {
        title: ['Sample Test'],
        state: 'passed',
        duration: 100,
      }

      ;(reporter as any).updateCtrfResultsFromAfterSpecResults({
        tests: [mockTest],
      })

      const updatedTestResult = reporter['ctrfReport'].results.tests[0]

      expect(updatedTestResult.name).toBe(mockTest.title.join(' '))
      expect(updatedTestResult.status).toBe(mockTest.state)
      expect(updatedTestResult.duration).toBe(mockTest.duration)
    })

    it.each([
      [['Test 1'], 'passed', 100],
      [['Test 2'], 'failed', 200],
      [['Test 4'], 'pending', 300],
      [['Test 3'], 'skipped', 400],
    ])(
      'should correctly update the ctrfReport for test "%s" with status "%s" and duration %i',
      (testTitle, status, duration) => {
        const mockTest: CypressTest = {
          title: testTitle,
          state: status as CypressTestState,
          duration: duration,
        }

        ;(reporter as any).updateCtrfResultsFromAfterSpecResults({
          tests: [mockTest],
        })

        const updatedTestResult =
          reporter['ctrfReport'].results.tests[
            reporter['ctrfReport'].results.tests.length - 1
          ]

        expect(updatedTestResult.name).toBe(testTitle.join(' '))
        expect(updatedTestResult.status).toBe(status)
        expect(updatedTestResult.duration).toBe(duration)
      }
    )
    it('should use wallClockDuration from the last attempt if duration is absent', () => {
      const mockTest: CypressTest = {
        title: ['Test without duration'],
        state: 'passed',
        attempts: [
          {
            state: 'passed',
            wallClockDuration: 150,
          },
          {
            state: 'passed',
            wallClockDuration: 250,
          },
        ],
      }

      ;(reporter as any).updateCtrfResultsFromAfterSpecResults({
        tests: [mockTest],
      })

      const updatedTestResult = reporter['ctrfReport'].results.tests[0]

      expect(updatedTestResult.name).toBe(mockTest.title.join(' '))
      expect(updatedTestResult.status).toBe(mockTest.state)
      expect(updatedTestResult.duration).toBe(250)
    })

    it('should default duration to 0 if both duration and attempts are absent', () => {
      const mockTest: CypressTest = {
        title: ['Test without duration or attempts'],
        state: 'passed',
      }

      ;(reporter as any).updateCtrfResultsFromAfterSpecResults({
        tests: [mockTest],
      })

      const updatedTestResult = reporter['ctrfReport'].results.tests[0]

      expect(updatedTestResult.name).toBe(mockTest.title.join(' '))
      expect(updatedTestResult.status).toBe(mockTest.state)
      expect(updatedTestResult.duration).toBe(0)
    })
  })

  describe('updateCtrfTotalFromAfterRun', () => {
    it('should update the total tests count', () => {
      const mockRun: CypressAfterRun = {
        totalTests: 1,
        totalPassed: 1,
        totalFailed: 0,
        totalSkipped: 0,
        totalPending: 0,
        totalSuites: 0,
      }

      ;(reporter as any).updateCtrfTotalsFromAfterRun(mockRun)

      expect(reporter['ctrfReport'].results.summary.tests).toBe(
        mockRun.totalTests
      )
    })

    it.each([
      ['passed', 1, 0, 0, 0, 0],
      ['failed', 0, 1, 0, 0, 0],
      ['skipped', 0, 0, 1, 0, 0],
      ['pending', 0, 0, 0, 1, 0],
    ])(
      'should update for status %s',
      (_status, passed, failed, skipped, pending) => {
        const mockRun: CypressAfterRun = {
          totalTests: 1,
          totalPassed: passed,
          totalFailed: failed,
          totalSkipped: skipped,
          totalPending: pending,
          totalSuites: 0,
        }

        ;(reporter as any).updateCtrfTotalsFromAfterRun(mockRun)

        expect(reporter['ctrfReport'].results.summary.passed).toBe(passed)
        expect(reporter['ctrfReport'].results.summary.failed).toBe(failed)
        expect(reporter['ctrfReport'].results.summary.skipped).toBe(skipped)
        expect(reporter['ctrfReport'].results.summary.pending).toBe(pending)
      }
    )
  })

  describe('getScreenshot', () => {
    beforeEach(() => {
      fs.readFileSync.mockClear()
      fs.readFileSync.mockImplementation(
        (path: string) => `base64-encoded-${path}`
      )
    })

    it('should return undefined when screenshot option is false', () => {
      reporter = new GenerateCtrfReport({
        on: mockOn,
        screenshot: false,
      })

      const test: CypressTest = {
        title: ['Test', 'With Screenshot'],
        state: 'passed',
      }

      const results = {
        screenshots: [{ path: '/path/to/Test -- With Screenshot.png' }],
      }

      const screenshot = (reporter as any).getScreenshot(test, results)
      expect(screenshot).toBeUndefined()
    })

    it('should return the failed screenshot when available', () => {
      reporter = new GenerateCtrfReport({
        on: mockOn,
        screenshot: true,
      })

      const test: CypressTest = {
        title: ['Test', 'With Failed Screenshot'],
        state: 'failed',
      }

      const results = {
        screenshots: [
          { path: '/path/to/Test -- With Failed Screenshot (failed).png' },
        ],
      }

      const screenshot = (reporter as any).getScreenshot(test, results)
      expect(screenshot).toBe(
        'base64-encoded-/path/to/Test -- With Failed Screenshot (failed).png'
      )
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/path/to/Test -- With Failed Screenshot (failed).png',
        { encoding: 'base64' }
      )
    })

    it('should return the last screenshot when multiple exist for the same test', () => {
      reporter = new GenerateCtrfReport({
        on: mockOn,
        screenshot: true,
      })
      const test: CypressTest = {
        title: ['Test', 'With Multiple Screenshots'],
        state: 'passed',
      }

      const results = {
        screenshots: [
          { path: '/path/to/Test -- With Multiple Screenshots (1).png' },
          { path: '/path/to/Test -- With Multiple Screenshots (2).png' },
          { path: '/path/to/Test -- With Multiple Screenshots (3).png' },
        ],
      }

      const screenshot = (reporter as any).getScreenshot(test, results)
      expect(screenshot).toBe(
        'base64-encoded-/path/to/Test -- With Multiple Screenshots (3).png'
      )
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/path/to/Test -- With Multiple Screenshots (3).png',
        { encoding: 'base64' }
      )
    })

    it('should prioritize failed screenshot when both failed and normal screenshots exist', () => {
      reporter = new GenerateCtrfReport({
        on: mockOn,
        screenshot: true,
      })
      const test: CypressTest = {
        title: ['Test', 'With Both Types'],
        state: 'failed',
      }

      const results = {
        screenshots: [
          { path: '/path/to/Test -- With Both Types (1).png' },
          { path: '/path/to/Test -- With Both Types (failed).png' },
          { path: '/path/to/Test -- With Both Types (2).png' },
        ],
      }

      const screenshot = (reporter as any).getScreenshot(test, results)
      expect(screenshot).toBe(
        'base64-encoded-/path/to/Test -- With Both Types (failed).png'
      )
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/path/to/Test -- With Both Types (failed).png',
        { encoding: 'base64' }
      )
    })

    it('should return undefined when no screenshots match the test', () => {
      reporter = new GenerateCtrfReport({
        on: mockOn,
        screenshot: true,
      })
      const test: CypressTest = {
        title: ['Test', 'With No Matching Screenshots'],
        state: 'passed',
      }

      const results = {
        screenshots: [
          { path: '/path/to/Different -- Test.png' },
          { path: '/path/to/Another -- Different -- Test.png' },
        ],
      }

      const screenshot = (reporter as any).getScreenshot(test, results)
      expect(screenshot).toBeUndefined()
      expect(fs.readFileSync).not.toHaveBeenCalled()
    })

    it('should return undefined when screenshots array is empty', () => {
      reporter = new GenerateCtrfReport({
        on: mockOn,
        screenshot: true,
      })
      const test: CypressTest = {
        title: ['Test'],
        state: 'passed',
      }

      const results = {
        screenshots: [],
      }

      const screenshot = (reporter as any).getScreenshot(test, results)
      expect(screenshot).toBeUndefined()
      expect(fs.readFileSync).not.toHaveBeenCalled()
    })

    it('should return undefined when screenshots is undefined', () => {
      reporter = new GenerateCtrfReport({
        on: mockOn,
        screenshot: true,
      })
      const test: CypressTest = {
        title: ['Test'],
        state: 'passed',
      }

      const results = {}

      const screenshot = (reporter as any).getScreenshot(test, results)
      expect(screenshot).toBeUndefined()
      expect(fs.readFileSync).not.toHaveBeenCalled()
    })

    it('should handle empty paths in screenshots array', () => {
      reporter = new GenerateCtrfReport({
        on: mockOn,
        screenshot: true,
      })
      const test: CypressTest = {
        title: ['Test', 'With Empty Path'],
        state: 'passed',
      }

      const results = {
        screenshots: [
          { path: '' },
          { path: '/path/to/Test -- With Empty Path.png' },
        ],
      }

      const screenshot = (reporter as any).getScreenshot(test, results)
      expect(screenshot).toBe(
        'base64-encoded-/path/to/Test -- With Empty Path.png'
      )
      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/path/to/Test -- With Empty Path.png',
        { encoding: 'base64' }
      )
    })
  })
})
