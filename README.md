# Cypress JSON Reporter - CTRF

A Cypress test reporter to generate JSON test reports that are [CTRF](https://ctrf.io) compliant.

[Common Test Report Format](https://ctrf.io) helps you generate consistent JSON reports that are agnostic of specific programming languages or test frameworks.

## Features

- Generate JSON test reports that are [CTRF](https://ctrf.io) compliant
- Straightforward integration with Cypress

## What is CTRF?

A JSON test report schema that is the same structure, no matter which testing tool is used. It's created to provide consistent test reporting agnostic of specific programming languages or testing frameworks. Where many testing frameworks exist, each generating JSON reports in their own way, CTRF provides a standardised schema helping you generate the same report anywhere.

## Installation

```bash
npm install --save-dev cypress-ctrf-json-reporter
```

Add the reporter to your cypress.config.js/ts file:

```javascript
const { defineConfig } = require('cypress')
const { generateCypressCtrfJsonReport } = require('cypress-ctrf-json-report')

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Implement node event listeners here
      GenerateCtrfReport({
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
const { generateCypressCtrfJsonReport } = require('cypress-ctrf-json-report')

/// <reference types="cypress" />

/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
  GenerateCtrfReport({
    on,
  })
}
```

## Reporter Options

The reporter supports several configuration options:

```javascript
GenerateCtrfReport({
        on, {
              outputFile: 'custom-name.json', // Optional: Output file name. Defaults to 'ctrf-report.json'.
              outputDir: 'custom-directory',  // Optional: Output directory path. Defaults to 'ctrf'.
              appName: 'MyApp',               // Optional: Specify the name of the application under test.
              appVersion: '1.0.0',            // Optional: Specify the version of the application under test.
              osPlatform: 'linux',            // Optional: Specify the OS platform.
              osRelease: '18.04',             // Optional: Specify the OS release version.
              osVersion: '5.4.0',             // Optional: Specify the OS version.
              buildName: 'MyApp Build',       // Optional: Specify the build name.
              buildNumber: '100',             // Optional: Specify the build number.
            }
})

```

## Test Object Properties

The test object in the report includes the following [CTRF properties](https://ctrf.io/docs/schema/test):

| Name       | Type   | Required | Details                                                                             |
| ---------- | ------ | -------- | ----------------------------------------------------------------------------------- |
| `name`     | String | Required | The name of the test.                                                               |
| `status`   | String | Required | The outcome of the test. One of: `passed`, `failed`, `skipped`, `pending`, `other`. |
| `duration` | Number | Required | The time taken for the test execution, in milliseconds.                             |
