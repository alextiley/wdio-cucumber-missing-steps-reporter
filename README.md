# wdio-cucumber-missing-steps-reporter
Reports missing cucumber steps when running the wdio test runner

## Usage ##
1. To install, run `yarn add wdio-cucumber-missing-steps-reporter` or `npm install wdio-cucumber-missing-steps-reporter`
2. Add `cucumber-missing-steps` to the list of reporters in `wdio.conf.js`.
3. Add reporter config to `wdio.conf.js`. See below.
4. Run your tests

## Config ##

This project is not clever enough to work out where your app's base directory is. The reporter needs this in order to read from your .feature files to be able to determine correct methods, etc.
 
You'll need to configure this in `wdio.conf.js` by adding the below (or similar):

```
  reporterOptions: {
    ...
    cucumberMissingStepsReporter: {
      baseDir: __dirname,
    },
    ...
  },
```

## Bug reporting ##

Feel free to raise a pull request, or throw me a ticket via the issues section.
