import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import SpecRunnerConfig from '../SpecRunnerConfig';

export class AllSpecsRunnerButton {
  button: vscode.StatusBarItem;
  config: SpecRunnerConfig;
  private hasSpecDirectory: boolean = false;

  constructor(button: vscode.StatusBarItem, config: SpecRunnerConfig) {
    this.button = button;
    this.config = config;

    this.button.text = '$(play) Run all specs';
    this.button.tooltip = 'Run all specs';
    this.button.command = 'ruby-spec-runner.runAllExamples';
    
    // Check if spec directory exists
    this.checkForSpecDirectory();
  }

  private checkForSpecDirectory(): void {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      this.hasSpecDirectory = false;
      return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const specPath = path.join(workspaceRoot, 'spec');
    
    this.hasSpecDirectory = fs.existsSync(specPath) && fs.statSync(specPath).isDirectory();
  }

  update(editor = vscode.window.activeTextEditor) {
    // Only show the button if we have a spec directory and the setting is enabled
    if (this.config.rspecRunAllExamplesButton && this.hasSpecDirectory) {
      this.button.show();
    } else {
      this.button.hide();
    }
  }
};

export default AllSpecsRunnerButton; 
