// Standard import
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
// NPM import
import * as vscode from 'vscode';
import axios from 'axios';
// @ts-ignore
import * as j2m from 'jira2md';

const extensionName = 'jira-quick-info';

let myStatusBarItem: vscode.StatusBarItem;
let apiToken: string;

function setConfigProperty(property: string, value: string, scope: vscode.ConfigurationTarget): void {
	// If VSCode hasn't opened a workspace, default to global setting
	try {
		vscode.workspace.getConfiguration(extensionName).update(property, value, scope);
	} catch (e) {
		vscode.workspace.getConfiguration(extensionName).update(property, value, vscode.ConfigurationTarget.Global);
	}
}

function getConfigProperty(property: string): string {
	// Not sure that this isn't already VSCode default behavior for getConfiguration
	const configName = extensionName;
	let value: string | undefined;

	// 1. Attempt to retrieve from the any workspace folder's configuration
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders && workspaceFolders.length > 0) {
		for (const folder of workspaceFolders) {
			value = vscode.workspace.getConfiguration(configName, folder).get(property);
			if (value)
				return value as string;
		}
	}

	// 2. Attempt to retrieve from the workspace configuration
	value = vscode.workspace.getConfiguration(configName, null).get(property);
	if (value)
		return value as string;

	// 3. Attempt to retrieve from the global configuration
	value = vscode.workspace.getConfiguration(configName).get(property);
	if (value)
		return value as string;

	// If not found in any scope, return an empty string or a default value
	return '';
}

function getApiToken(): string {
	// Get PAT from file or 
	if (apiToken)
		return apiToken;

	const apiTokenPath = path.resolve(getConfigProperty('tokenPath'));
	if (apiTokenPath) {
		if (fs.existsSync(apiTokenPath)) {
			apiToken = fs.readFileSync(apiTokenPath, 'utf8').trim();
			return apiToken;
		} else {
			vscode.window.showErrorMessage(`Can't read PAT at ${apiTokenPath}`);
		}
	}
	return '';
}

async function fetchIssueDetails(key: string): Promise<any> {
	const baseUrl = getConfigProperty('url');
	try {
		const agent = new https.Agent({
			rejectUnauthorized: false
		});
		const response = await axios.get(`${baseUrl}/rest/api/2/issue/${key}`, {
			httpsAgent: agent,
			headers: { 'Authorization': `Bearer ${apiToken}` }
		});
		if (response.status !== 200) {
			vscode.window.showErrorMessage(`Got error ${response.status} for issue ${key}`);
			return undefined;
		}
		return response.data.fields;
	} catch (error) {
		const apiTokenPath = path.resolve(getConfigProperty('tokenPath'));
		vscode.window.showErrorMessage(`Unable to authenticate to ${baseUrl} with your PAT at ${apiTokenPath}`);
		return undefined;
	}
}

function parseIssueDetails(key: string, fields: any): string {
	if (fields === undefined) {
		throw new Error(`Can't find issue ${key}. (Check your PAT, the URL or your issue number)`)
	}

	let msg = key;
	msg += ' |'
	if (fields.summary as string)
		msg += ` ${fields.summary}`;
	else
		msg += 'Summary:None';
	if (fields.status !== undefined && fields.status.name as string)
		msg += `( ${fields.status.name}`;
	else
		msg += '( Status:unknown'
	if (fields.assigne !== undefined && fields.assigne.displayName as string)
		msg += ` ${fields.status.name})`;
	else
		msg += ' Assignee:Unassigned)'
	return msg;
}

function getTooltip(label:string, fields: any): vscode.MarkdownString {
	const mdString = new vscode.MarkdownString();
	const baseUrl = getConfigProperty('url');
	mdString.appendMarkdown(`Click to open ${baseUrl}/browse/${label}\n\n`);
	if (fields !== undefined) {
		mdString.appendMarkdown(j2m.to_markdown(fields.description));
	}

	mdString.isTrusted = true;
	return mdString;
}

function openIssueInBrowser(baseUrl: string, issue: string): void {
	if (!baseUrl || !issue) {
		vscode.window.showErrorMessage('Base URL and/or issue is missing.');
	}
 	vscode.env.openExternal(vscode.Uri.parse(`${baseUrl}/browse/${issue}`));
}

async function setStatusBar(label:string, baseUrl: string, fields: any): Promise<void> {
	try {
		myStatusBarItem.text = parseIssueDetails(label,fields);
		myStatusBarItem.tooltip = getTooltip(label,fields);
		myStatusBarItem.command = {
			title: 'openIssueInBrowser',
			command: extensionName+'.openIssueInBrowser',
			arguments: [baseUrl, label]
		};
	} catch (error) {
		myStatusBarItem.text = (<Error>error).message;
	}

	myStatusBarItem.show();
}

async function changeIssue() {
	let issue = await vscode.window.showInputBox({
		prompt: "Please set your issue label.",
		placeHolder: "LABEL-1234",
		ignoreFocusOut: true
	}) as string;

	if (!issue) {
		vscode.window.showErrorMessage('No issue provided.');
	} else {
		setConfigProperty('issue', issue, vscode.ConfigurationTarget.WorkspaceFolder);
		let baseUrl = getConfigProperty('url');
		if (!baseUrl) {
			baseUrl = await changeUrl();
		}
		const fields = await fetchIssueDetails(issue);
		await setStatusBar(issue,baseUrl,fields);
	}
}

async function changeUrl(): Promise<string> {
	let baseUrl = await vscode.window.showInputBox({
		prompt: "Please set the base URL of your JIRA instance.",
		placeHolder: "https://something.com/jira",
		ignoreFocusOut: true
	}) as string;
	
	if (!baseUrl) {
		vscode.window.showErrorMessage('No URL provided.');
	} else {
		setConfigProperty('url', baseUrl, vscode.ConfigurationTarget.Global);
	}
	return baseUrl;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension extensionName is now active!');

	// Adding commands
	context.subscriptions.push(
		vscode.commands.registerCommand(extensionName+'.changeIssue',changeIssue)
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(extensionName+'.openIssueInBrowser',openIssueInBrowser)
	);

	// Verify we got the API token
	apiToken = getApiToken();
	if (!apiToken) {
		vscode.window.showErrorMessage('Unable to get API token.');
		return;
	}

	if (myStatusBarItem == undefined) {
		myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	}
	
	// Init the extension if label & url are already set
	let baseUrl = getConfigProperty('url');
	let label = getConfigProperty('issue');

	// Issue default is current workspace basename
	if (!label) {
		if (vscode.workspace.workspaceFile) {
			label = path.dirname(vscode.workspace.workspaceFile.fsPath);
		} else if (vscode.workspace.workspaceFolders) {
			label = path.basename(vscode.workspace.workspaceFolders[0].uri.fsPath);
		}
	}

	if (baseUrl && label)
	{
		const issue = label as string;
		const url = baseUrl as string;
		
		fetchIssueDetails(issue).then( (fields) => {
			setStatusBar(issue,url,fields).then(() => {});
		});
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
