/**
 * @class {EventEmitter}
 */
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const Gherkin = require('gherkin');
const colors = require('colors');
const _ = require('lodash');

class CucumberMissingStepsReporter extends EventEmitter {

  constructor(baseReporter, config, options = {}) {
    super();

    this.baseReporter = baseReporter;
    this.config = config;
    this.cachedFeatures = {};
    this.options = options;
    this.snippets = {};
    this.snippetMethods = [];

    this.ARGS_REGEX = /<([^<>]+)>/gm;

    this.on('test:pending', this.build);
    this.on('end', this.notify);
  }

  /**
   * Build a series of snippets for pending, undefined specs
   * @param spec
   */
  build(spec) {
    // Get step (and its keyword + text) from .feature file
    // We can not use spec.title as this contains substituted placeholders (scenario outline data)
    const step = this.getStep(spec.file, this.getLineNumberFromUid(spec.uid));

    if (step === null) {
      return;
    }

    let keyword = step.keyword.trim().toLowerCase();

    if (
      keyword !== 'after' &&
      keyword !== 'before' &&
      this.hasUndefinedStepMessage(spec.title)
    ) {
      // Replace arguments with simple regular expression string
      const title = this.buildTitleFromSpecText(step.text);
      // Check for arguments to add to method signature
      const args = this.buildArgumentsFromSpecText(step.text);
      // Build JavaScript snippet
      const snippet = this.buildSnippet(step.cucumberMethod, title, args);
      // Only add unique snippets to log output
      if (!this.hasSnippet(title)) {
        this.addSnippet(title, snippet);
      }
      if (!this.hasMethod(step.cucumberMethod)) {
        this.addMethod(step.cucumberMethod);
      }
    }
  }

  /**
   * Does a snippet by this key already exist in the list of snippets?
   * @param key
   * @returns {boolean}
   */
  hasSnippet(key) {
    return (typeof this.snippets[key] !== 'undefined');
  }

  /**
   * Does this cucumber method already exist in the list of imports?
   * @param method
   * @returns {boolean}
   */
  hasMethod(method) {
    return (this.snippetMethods.indexOf(method) > -1);
  }

  /**
   * Add a snippet to the array of logged snippets
   * @param key
   * @param snippet
   */
  addSnippet(key, snippet) {
    this.snippets[key] = snippet;
  }

  /**
   * Add a cucumber method for output in the generated import statement
   * @param method
   */
  addMethod(method) {
    this.snippetMethods.push(method);
  }

  /**
   * Determines whether a spec title indicates where it is undefined or not
   * wdio spec.title contains " (undefined step)" if not implemented.
   * @param title
   * @returns {boolean}
   */
  hasUndefinedStepMessage(title) {
    return (title.indexOf(' (undefined step)') > -1);
  }

  /**
   * Checks spec text for placeholders and creates a string of arguments
   * @return {string}
   */
  buildArgumentsFromSpecText(text) {
    let match;
    let args = [];
    while ((match = this.ARGS_REGEX.exec(text)) !== null) {
      args.push(_.camelCase(match[1]));
    }
    return args.join(', ');
  }

  /**
   * Formats a title for the snippet. Replaces placeholders with a simple regular expression.
   * @param text
   * @returns {string}
   */
  buildTitleFromSpecText(text) {
    return text.replace(this.ARGS_REGEX, '(.*)');
  }

  /**
   * Builds a missing step definition snippet (ES6)
   * @param method
   * @param title
   * @param args
   * @returns {{open: string, body: string, close: string}}
   */
  buildSnippet(method, title, args) {
    return {
      open: `${method}(/^${title}$/, (${args}) => {`,
      body: '  // Pending',
      close: '});',
    }
  }

  /**
   * Outputs step definition snippets to the console
   */
  notify() {
    const keys = Object.keys(this.snippets);

    if (keys.length) {
      console.log('You can implement step definitions for undefined steps with these snippets:'.bold, '\n');

      if (this.snippetMethods.length > 0) {
        console.log(`import { ${this.snippetMethods.sort().join(', ')} } from 'cucumber';`.yellow, '\n');
      }

      keys.forEach((key) => {
        console.log(this.snippets[key].open.yellow);
        console.log(this.snippets[key].body.grey);
        console.log(this.snippets[key].close.yellow, '\n');
      });
    }
  }

  /**
   * Parses a gherkin feature file and transforms to JSON
   * @param filePath - the path to the gherkin .feature file
   * @returns {number|*}
   */
  parseFeature(filePath) {
    const featurePath = path.join(process.cwd(), filePath);
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
    let ret = null;
    let findParent = false;
    const feature = this.getFeature(filePath);

    // Reverse loop over scenarios and steps so that we can find the correct cucumber method for 'And' and 'But' steps
    for (let i = feature.children.length - 1; i >= 0; i--) {
      for (let n = feature.children[i].steps.length - 1; n >= 0; n--) {
        const step = feature.children[i].steps[n];
        // Matching step
        if (ret === null && step.location.line === stepLineNumber) {
          ret = step;
          if (ret.keyword.trim() === 'And' || ret.keyword.trim() === 'But') {
            findParent = true;
            continue;
          } else {
            ret.cucumberMethod = ret.keyword.trim();
            break;
          }
        }
        // All steps - find parent keyword if necessary
        if (findParent === true) {
          switch (step.keyword.trim()) {
            case 'Given': case 'When': case 'Then':
              ret.cucumberMethod = step.keyword.trim();
              findParent = false;
          }
          if (findParent === false) {
            break;
          }
        }
      }
      if (ret !== null && findParent === false) {
        break;
      }
    }

    return ret;
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
