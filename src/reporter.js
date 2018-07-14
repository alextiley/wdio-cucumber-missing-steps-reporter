/**
 * @class {EventEmitter}
 */
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const Gherkin = require('gherkin');
const colors = require('colors');

class CucumberMissingStepsReporter extends EventEmitter {

  constructor(baseReporter, config, options = {}) {
    super();

    if (
      typeof options.cucumberMissingStepsReporter === 'undefined' ||
      typeof options.cucumberMissingStepsReporter.baseDir === 'undefined'
    ) {
      console.log('Unable to generate missing step snippets: missing reporters.cucumberMissingStepsReporter.baseDir in wdio.conf.js config file.');
      return;
    }

    this.baseReporter = baseReporter;
    this.config = config;
    this.cachedFeatures = {};
    this.options = options;
    this.snippets = [];

    this.on('test:pending', this.build);
    this.on('end', this.notify);
  }

  build(spec) {
    // Get step (and its keyword + text) from .feature file
    // We can not use spec.title as this contains substituted placeholders (scenario outline data)
    const step = this.getStep(spec.file, this.getLineNumberFromUid(spec.uid));

    // Ignore hooks
    if (step.keyword !== 'After' && step.keyword !== 'Before') {
      // wdio spec.title contains " (undefined step)" if not implemented. Hook into that.
      if (spec.title.indexOf(' (undefined step)') > -1) {
        // Build JavaScript snippet
        let snippet = step.keyword.trim() + '(/^' + step.text + '$/, () => {\n\t// Implement me!\n});';
        // Replace placeholders with (.*) - output: "<some_arg>" => "(.*)"
        snippet.replace(/<\w+>/gm, '(.*)');
        // Only add unique snippets to log output
        if (this.snippets.indexOf(snippet) === -1) {
          this.snippets.push(snippet);
        }
      }
    }
  }

  notify() {
    console.log('Please implement the following pending steps:'.yellow, '\n');
    this.snippets.forEach((snippet) => {
      console.log(snippet.yellow, '\n');
    });
  }

  /**
   * Parses a gherkin feature file and transforms to JSON
   * @param filePath - the path to the gherkin .feature file
   * @returns {number|*}
   */
  parseFeature(filePath) {
    const featurePath = path.join(this.options.cucumberJsonReporter.baseDir, filePath);
    const featureText = fs.readFileSync(featurePath).toString();
    const parser = new Gherkin.Parser(new Gherkin.AstBuilder());
    const scanner = new Gherkin.TokenScanner(featureText);
    const matcher = new Gherkin.TokenMatcher();

    return parser.parse(scanner, matcher);
  }

  /**
   * Given a gherkin file path and line number, finds the step with the relevant
   * .feature file and returns the step's meta data.
   *
   * @param filePath
   * @param stepLineNumber
   * @returns {{}}
   */
  getStep(filePath, stepLineNumber) {
    let step = {};
    const feature = this.getFeature(filePath);

    feature.children.forEach((scenario) => {
      scenario.steps.forEach((currStep) => {
        if (currStep.location.line === stepLineNumber) {
          step = currStep;
        }
      });
    });

    return step;
  }

  /**
   * Given a gherkin file path, finds the feature within the .feature file
   * and returns the feature's meta data
   *
   * @param filePath - the path to the gherkin .feature file
   * @returns {*}
   */
  getFeature(filePath) {
    if (typeof this.cachedFeatures[filePath] !== 'undefined') {
      return this.cachedFeatures[filePath];
    }
    const document = this.parseFeature(filePath);

    this.cachedFeatures[filePath] = document.feature;

    return document.feature;
  }

  /**
   * The UID returned from wdio contains the step's line number from the .feature file
   * This helper will extract it from the UID string
   * @param uid
   * @returns {number}
   */
  getLineNumberFromUid(uid) {
    let line = uid.match(/\d+$/);

    if (line === null || !Array.isArray(line) || isNaN(Number(line[0]))) {
      return -1;
    }
    return Number(line);
  }
}

CucumberMissingStepsReporter.reporterName = 'missing-steps';

module.exports = CucumberMissingStepsReporter;
