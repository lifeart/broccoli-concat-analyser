'use strict';

const chai = require('chai');
const expect = chai.expect;
const tmp = require('tmp');
const chaiFiles = require('chai-files');
const file = chaiFiles.file;
const path = require('path');
const cp = require('child_process');
const fs = require('fs-extra');
const validate = require('html-validator');
const copyFixtures = require('../helpers/copy-fixtures');

const inputFixturePath = 'test/fixtures/input';
const outputFixturePath = 'test/fixtures/output';

const inputFiles = ['1-test-app.js', '3-vendor.css', '8-test-support.css'];

const originalCwd = process.cwd();
let tmpPath;
let outPath;

chai.use(chaiFiles);

function run() {
  let stdout = '';
  let stderr = '';

  return new Promise(resolve => {
    let ps = cp.spawn('node', [
      path.join(originalCwd, 'lib/cli.js'),
      './concat-stats-for'
    ], {
      cwd: tmpPath
    });

    ps.stdout.on('data', data => {
      stdout += data.toString();
    });

    ps.stderr.on('data', data => {
      stderr += data.toString();
    });

    ps.on('exit', code => {
      resolve({
        exitCode: code,
        stdout,
        stderr
      });
    });
  });
}

describe('CLI', function() {

  beforeEach(function() {
    tmpPath = fs.realpathSync(tmp.dirSync().name);
    outPath = path.join(tmpPath, 'concat-stats-for');
    fs.ensureDirSync(outPath);
    copyFixtures(inputFiles, inputFixturePath, outPath);
  });

  it('generates expected output', function() {
    return run()
      .then(result => {
        let exitCode = result.exitCode;
        let stdout = result.stdout;

        expect(exitCode).to.equal(0);
        expect(stdout).to.contain(`visit file://${outPath}/index.html`);

        // write .out.json files
        inputFiles.forEach((inputFile) => {
          let outputFile = `${inputFile}.out.json`;
          expect(file(path.join(outPath, outputFile))).to.equal(file(path.join(outputFixturePath, outputFile)));
        });

        // copies static output files
        expect(file(path.join(outPath, 'index.html'))).to.exist;

        let data = fs.readFileSync(`${outPath}/index.html`, 'UTF8');
        expect(data).to.contain('var SUMMARY = {');

        return validate({
          data,
          format: 'json'
        })
          .then(response => {
            let error = response.messages.find(msg => msg.type === 'error');
            if (error) {
              throw new Error(`HTML validation error in index.html at L${error.lastLine}:${error.firstColumn}-${error.lastColumn}: ${error.message}\n${error.extract}`);
            }

          })
      });
  });

});

