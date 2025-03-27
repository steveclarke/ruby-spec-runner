import * as vscode from 'vscode';
import SpecRunnerConfig from '../SpecRunnerConfig';

export class AllSpecsRunnerButton {
  button: vscode.StatusBarItem;
  config: SpecRunnerConfig;

  constructor(button: vscode.StatusBarItem, config: SpecRunnerConfig) {
    this.button = button;
    this.config = config;

    this.button.text = '$(play) Run all specs';
    this.button.tooltip = 'Run all specs';
    this.button.command = 'ruby-spec-runner.runAllExamples';
  }

  update(editor = vscode.window.activeTextEditor) {
    if (this.config.rspecRunAllExamplesButton) {
      this.button.show();
    } else {
      this.button.hide();
    }
  }
};

export default AllSpecsRunnerButton; 
