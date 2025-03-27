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
    this.button.tooltip = 'Run all specs in the project';
    this.button.command = 'ruby-spec-runner.runAllExamples';
    
    // Check if spec directory exists initially
    this.checkForSpecDirectory();
    
    // Watch for workspace folder changes to update button visibility
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.checkForSpecDirectory();
      this.update();
    });
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

  update(editor?: vscode.TextEditor): void {
    // Only depends on workspace having a spec directory, not on active editor
    if (this.config.rspecRunAllExamplesButton && this.hasSpecDirectory) {
      this.button.show();
    } else {
      this.button.hide();
    }
  }
};

export default AllSpecsRunnerButton; 
