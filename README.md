# wdio-cucumber-missing-steps-reporter
Reports missing cucumber steps when running the wdio test runner

## Usage ##
1. To install, run `yarn add wdio-cucumber-missing-steps-reporter` or `npm install wdio-cucumber-missing-steps-reporter`
2. Add `cucumber-missing-steps` to the list of reporters in `wdio.conf.js` (see below).
3. Run your tests

#### wdio.conf.js
```
  ...
  reporters: ['dot', 'cucumber-missing-steps'],
  ...
```

## Bug reporting ##

Feel free to raise a pull request, or throw me a ticket via the issues section.
