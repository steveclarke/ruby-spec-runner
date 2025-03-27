import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import SpecRunnerConfig, { TerminalClear } from '../SpecRunnerConfig';
import { cdCommands, cmdJoin, quote, remapPath, stringifyEnvs } from '../util';
import SpecResultPresenter from '../SpecResultPresenter';
import { RubyDebugger, RunRspecOrMinitestArg } from '../types';

export class SpecRunner {
  private _term!: vscode.Terminal;
  private config: SpecRunnerConfig;
  private outputFilePath: string;
  private presenter: SpecResultPresenter;

  constructor(config: SpecRunnerConfig, outputFilePath: string, presenter: SpecResultPresenter) {
    this.config = config;
    this.outputFilePath = outputFilePath;
    this.presenter = presenter;
  }

  async runSpec(arg?: RunRspecOrMinitestArg) {
    if (this.config.saveBeforeRunning) {
      await vscode.commands.executeCommand('workbench.action.files.save');
    }

    if (arg?.fileName) {
      this.runSpecForFile(arg.fileName, false, arg.line, arg.name, arg.debugging);
    } else {
      this.runCurrentSpec(false, arg?.debugging);
    }
  }

  async runFailedExample() {
    if (this.config.saveBeforeRunning) {
      await vscode.commands.executeCommand('workbench.action.files.save');
    }

    this.runCurrentSpec(true);
  }

  async runAllExamples() {
    if (this.config.saveBeforeRunning) {
      await vscode.commands.executeCommand('workbench.action.files.save');
    }

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'ruby') {
      console.log('SpecRunner: Active editor is not a Ruby file, but proceeding with run all specs anyway.');
    }

    try {
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        throw { name: 'NoWorkspaceError' };
      }

      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const specPath = path.join(workspaceRoot, 'spec');
      
      if (!fs.existsSync(specPath) || !fs.statSync(specPath).isDirectory()) {
        vscode.window.showErrorMessage('SpecRunner: Unable to run all specs. No spec directory found.');
        return;
      }

      const command = this.buildRspecCommand('spec/', false);
      this.runTerminalCommand(command);
    } catch (error: any) {
      if (error?.name === 'NoWorkspaceError') {
        console.error('SpecRunner: Unable to run all specs as no workspace is open.', error);
        vscode.window.showErrorMessage('SpecRunner: Unable to run all specs. It appears that no workspace is open.');
      } else {
        console.error('SpecRunner: Error running all specs', error);
        vscode.window.showErrorMessage(`SpecRunner: Error running all specs: ${error.message || error}`);
      }
    }
  }

  async runSpecForFile(fileName: string, failedOnly: boolean, line?: number, testName?: string, debugging?: boolean) {
    try {
      if (debugging) {
        const debugConfig = this.buildRspecDebugConfig(this.remappedPath(fileName), failedOnly, this.config.rubyDebugger, line, testName);
        if (debugConfig) {
          vscode.debug.startDebugging(undefined, debugConfig);
        }
      } else {
        const command = this.buildRspecCommand(this.remappedPath(fileName), failedOnly, line, testName);
        this.runTerminalCommand(command);
      }

      this.presenter.setPending(fileName);
    } catch (error: any) {
      if (error?.name === 'NoWorkspaceError') {
        console.error('SpecRunner: Unable to run spec as no workspace is open.', error);
        vscode.window.showErrorMessage('SpecRunner: Unable to run spec. It appears that no workspace is open.');
      } else {
        throw error;
      }
    }
  }

  async runCurrentSpec(failedOnly=false, debugging?: boolean) {
    const filePath = vscode.window.activeTextEditor?.document.fileName;
    if (!filePath) {
      console.error('SpecRunner: Unable to run spec as no editor is open.');
      vscode.window.showErrorMessage('SpecRunner: Unable to run spec. It appears that no editor is open.');
      return;
    }

    await this.runSpecForFile(filePath, failedOnly, undefined, undefined, debugging);
  }

  private buildRspecDebugConfig(fileName: string, failedOnly: boolean,  rubyDebugger: RubyDebugger, line?: number, testName?: string): vscode.DebugConfiguration | undefined {
    switch (rubyDebugger) {
      case (RubyDebugger.Rdbg): {
        return {
          type: 'rdbg',
          name: 'SpecRdbgDebugger',
          request: 'launch',
          command: this.config.rspecCommand,
          script: quote(line ? [fileName, ':', line].join('') : fileName),
          env: {...this.config.rspecEnv, ...this.config.rspecDebugEnv},
          args: [
            `-f ${this.config.rspecFormat}`,
            this.config.rspecDecorateEditorWithResults ? `-f j --out ${quote(this.outputFilePath)}` : undefined
          ].filter(Boolean),
          askParameters: false,
          useTerminal: true, // Not using terminal seems to make rdbg stick a './` in front of the absolute path of the file (╯°□°)╯︵ ┻━┻
          cwd: this.config.changeDirectoryToWorkspaceRoot ? this.config.projectPath : undefined
        };
      }
      case (RubyDebugger.RubyLSP): {
        return {
          type: 'ruby_lsp',
          name: 'SpecRubyLSPDebugger',
          request: 'launch',
          program: [
            this.config.rspecCommand,
            `-f ${this.config.rspecFormat}`,
            this.config.rspecDecorateEditorWithResults ? `-f j --out ${quote(this.outputFilePath)}` : undefined,
            quote(line ? [fileName, ':', line].join('') : fileName)
          ].filter(Boolean).join(' '),
          env: this.config.rspecEnv,
          cwd: this.config.changeDirectoryToWorkspaceRoot ? this.config.projectPath : undefined
        };
      }
      default: {
        console.error('SpecRunner: Unable to generate debug config. Unknown configured debugger option: ', rubyDebugger);
        vscode.window.showErrorMessage(`SpecRunner: Unable to debug spec. Unknown configured debugger option: ${rubyDebugger}`);
      }
    }
  }

  private buildRspecCommand(fileName: string, failedOnly: boolean, line?: number, testName?: string) {
    const file = line ? [fileName, ':', line].join('') : fileName;
    const failedOnlyModifier = failedOnly ? '--only-failures' : '';
    const format = `-f ${this.config.rspecFormat}`;
    const jsonOutput = this.config.rspecDecorateEditorWithResults ? `-f j --out ${quote(this.outputFilePath)}` : '';

    const [cdCommand, returnCommand] = this.buildChangeDirectoryToWorkspaceRootCommand();
    const rspecCommand = [stringifyEnvs(this.config.rspecEnv), this.config.rspecCommand, failedOnlyModifier, format, jsonOutput, quote(file)].filter(Boolean).join(' ');

    const fullCommand = cmdJoin(cdCommand, rspecCommand, returnCommand || '');

    // IMPORTANT: Fish shell compatibility depends on the cdCommands function in util.ts
    // For Fish shell, returnCommand should never be false to avoid parentheses syntax
    // which Fish interprets as command substitution rather than command grouping
    return returnCommand === false ? `(${fullCommand})` : fullCommand;
  }

  private remappedPath(filePath: string) {
    return remapPath(filePath, this.config.rewriteTestPaths);
  }

  private buildChangeDirectoryToWorkspaceRootCommand() {
    if (!this.config.changeDirectoryToWorkspaceRoot) {
      return ['', ''];
    }

    return cdCommands(this.config.projectPath, this.config.usingBashInWindows);
  }

  private async runTerminalCommand(command: string) {
    this.terminal.show();

    if (this.config.clearTerminalOnTestRun === TerminalClear.Clear) {
      await vscode.commands.executeCommand('workbench.action.terminal.clear');
    }

    this.terminal.sendText(command);
  }

  private get terminal() {
    if (!this._term || this._term.exitStatus) {
      this._term = vscode.window.createTerminal('SpecRunner');
    }

    return this._term;
  }
};

export default SpecRunner;
