# Cypress JSON Test Results Report

> Save Cypress test results as a JSON file

A Cypress JSON test reporter to create test reports that follow the CTRF standard.

[Common Test Report Format](https://ctrf.io) ensures the generation of uniform JSON test reports, independent of programming languages or test framework in use.

# **⭐⭐ If you find this project useful, consider giving it a GitHub star ⭐⭐**

## Help grow CTRF

You can help grow CTRF by doing the following:

- Follow the [CTRF organisation](https://github.com/ctrf-io)
- Give this repository a star ⭐

**It means a lot to us and helps us grow this open source library.**

## Features

- Generate JSON test reports that are [CTRF](https://ctrf.io) compliant
- Straightforward integration with Cypress

```json
{
  "results": {
    "tool": {
      "name": "cypress"
    },
    "summary": {
      "tests": 1,
      "passed": 1,
      "failed": 0,
      "pending": 0,
      "skipped": 0,
      "other": 0,
      "start": 1706828654274,
      "stop": 1706828655782
    },
    "tests": [
      {
        "name": "ctrf should generate the same report with any tool",
        "status": "passed",
        "duration": 100
      }
    ],
    "environment": {
      "appName": "MyApp",
      "buildName": "MyBuild",
      "buildNumber": "1"
    }
  }
}
```

## What is CTRF?

CTRF is a universal JSON test report schema that addresses the lack of a standardized format for JSON test reports.

**Consistency Across Tools:** Different testing tools and frameworks often produce reports in varied formats. CTRF ensures a uniform structure, making it easier to understand and compare reports, regardless of the testing tool used.

**Language and Framework Agnostic:** It provides a universal reporting schema that works seamlessly with any programming language and testing framework.

**Facilitates Better Analysis:** With a standardized format, programatically analyzing test outcomes across multiple platforms becomes more straightforward.

## Installation

```bash
npm install --save-dev cypress-ctrf-json-reporter
```

Add the reporter to your cypress.config.js/ts file:

```javascript
const { defineConfig } = require('cypress')
const { GenerateCtrfReport } = require('cypress-ctrf-json-reporter')

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      new GenerateCtrfReport({
        on,
      })
    },
  },
})
```

Run your tests:

```bash
npx cypress run
```

You'll find a JSON file named `ctrf-report.json` in the `ctrf` directory.

## Installation for Cypress versions below v10

Add the reporter to your cypress/plugins/index.js/ts

```javascript
const { GenerateCtrfReport } = require('cypress-ctrf-json-reporter')

/// <reference types="cypress" />

/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  new GenerateCtrfReport({
    on,
  })
}
```

## Reporter Options

The reporter supports several configuration options:

```javascript
new GenerateCtrfReport({
  on,
  outputFile: 'custom-name.json', // Optional: Output file name. Defaults to 'ctrf-report.json'.
  outputDir: 'custom-directory', // Optional: Output directory path. Defaults to 'ctrf'.
  minimal: true, // Optional: Generate a minimal report. Defaults to 'false'. Overrides screenshot and testType when set to true
  testType: 'e2e', // Optional: Specify the test type (e.g., 'api', 'e2e'). Defaults to 'e2e'.
  appName: 'MyApp', // Optional: Specify the name of the application under test.
  appVersion: '1.0.0', // Optional: Specify the version of the application under test.
  osPlatform: 'linux', // Optional: Specify the OS platform.
  osRelease: '18.04', // Optional: Specify the OS release version.
  osVersion: '5.4.0', // Optional: Specify the OS version.
  buildName: 'MyApp Build', // Optional: Specify the build name.
  buildNumber: '100', // Optional: Specify the build number.
  buildUrl: 'https://ctrf.io', // Optional: Specify the build url.
  repositoryName: 'ctrf-json', // Optional: Specify the repository name.
  repositoryUrl: 'https://gh.io', // Optional: Specify the repository url.
  branchName: 'main', // Optional: Specify the branch name.
  testEnvironment: 'staging', // Optional: Specify the test environment (e.g. staging, production).
})
```

## Handling Multiple Plugins in Cypress

Cypress's plugin system allows you to extend its functionality by adding event listeners to various lifecycle events like before:run, after:run, etc. However, a limitation in the Cypress plugin system is that it only supports one listener per event. This means that if you register multiple plugins that listen to the same event, the last registered plugin will override any previous ones.

This can cause issues when using multiple reporting plugins with cypress-ctrf-json-reporter as only one of them will actually execute its event handler.

To overcome this limitation, you can use a custom function to manage multiple event listeners for the same event, ensuring that all plugins work together seamlessly.

Follow the steps below to ensure that cypress-ctrf-json-reporter and other plugins work together without conflict.

### Step 1: Create a Custom initPlugins Function

In your Cypress configuration file (usually cypress.config.js), create a utility function to handle multiple plugins:

```javascript
function initPlugins(on, plugins) {
  const eventCallbacks = {};

  const customOn = (eventName, callback) => {
    if (!eventCallbacks[eventName]) {
      eventCallbacks[eventName] = [];
      // Register a single handler for each event that will execute all registered callbacks
      on(eventName, async (...args) => {
        for (const cb of eventCallbacks[eventName]) {
          await cb(...args);
        }
      });
    }
    eventCallbacks[eventName].push(callback);
  };

  // Initialize each plugin with the custom `on` handler
  plugins.forEach(plugin => plugin(customOn));
}
```

This function ensures that multiple event listeners for the same event are preserved and called in sequence, allowing multiple plugins to function together.

### Step 2: Modify Your Cypress Configuration

Use the initPlugins function to initialize your plugins, including cypress-ctrf-json-reporter. Here is an example using CTRF and the popular mochaawesome plugin:

```javascript
const { defineConfig } = require('cypress');
const { GenerateCtrfReport } = require('cypress-ctrf-json-reporter');
const mochawesome = require('cypress-mochawesome-reporter/plugin');

module.exports = defineConfig({
  reporter: "cypress-mochawesome-reporter",
  e2e: {
    setupNodeEvents(on, config) {
      // Initialize both plugins with the custom `on` handler
      initPlugins(on, [
        (on) => mochawesome(on),
        (on) => new GenerateCtrfReport({ on }),
      ]);
    },
  },
});
```

## Test Object Properties

The test object in the report includes the following [CTRF properties](https://ctrf.io/docs/schema/test):

| Name        | Type    | Required | Details                                                                             |
| ----------- | ------- | -------- | ----------------------------------------------------------------------------------- |
| `name`      | String  | Required | The name of the test.                                                               |
| `status`    | String  | Required | The outcome of the test. One of: `passed`, `failed`, `skipped`, `pending`, `other`. |
| `duration`  | Number  | Required | The time taken for the test execution, in milliseconds.                             |
| `message`   | String  | Optional | The failure message if the test failed.                                             |
| `trace`     | String  | Optional | The stack trace captured if the test failed.                                        |
| `rawStatus` | String  | Optional | The original cypress status of the test before mapping to CTRF status.              |
| `type`      | String  | Optional | The type of test (e.g., `api`, `e2e`).                                              |
| `filepath`  | String  | Optional | The file path where the test is located in the project.                             |
| `retries`   | Number  | Optional | The number of retries attempted for the test.                                       |
| `flaky`     | Boolean | Optional | Indicates whether the test result is flaky.                                         |
| `browser`   | String  | Optional | The browser used for the test.                                                      |

## Support Us

If you find this project useful, consider giving it a GitHub star ⭐ It means a lot to us.