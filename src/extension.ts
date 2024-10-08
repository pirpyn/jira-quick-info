// Standard import
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
// NPM import
import * as vscode from 'vscode';
import axios from 'axios';
// @ts-ignore
import * as j2m from 'jira2md';

// The extension name to set and get configuration properties
const extensionName = 'jira-quick-info';
// The status bar to update
let myStatusBarItem: vscode.StatusBarItem;
// the PAT to authenticate to jira
let apiToken: string;
// A custom "output" to log info to
let log: any;

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
	log.appendLine(`Jira PAT at ${apiTokenPath}`);
	if (apiTokenPath) {
		if (fs.existsSync(apiTokenPath)) {
			apiToken = fs.readFileSync(apiTokenPath, 'utf8').trim();
			log.appendLine(`PAT ${apiToken}`);
			return apiToken;
		} else {
			vscode.window.showErrorMessage(`Can't read PAT at ${apiTokenPath}`);
		}
	}
	return '';
}

async function getImage(url: string): Promise<any> {
	try {
		const agent = new https.Agent({
			rejectUnauthorized: false
		});
		const response = await axios.get(url, {
			httpsAgent: agent,
			headers: { 'Authorization': `Bearer ${apiToken}` },
			responseType: 'arraybuffer'
		});
		if (response.status !== 200) {
			vscode.window.showErrorMessage(`Got error ${response.status} for ${url}`);
			return undefined;
		}
		return response.data;
	} catch (error) {
		const apiTokenPath = path.resolve(getConfigProperty('tokenPath'));
		vscode.window.showErrorMessage(`Unable to get image ${url} with your PAT at ${apiTokenPath}`);
		return undefined;
	}
}

let globalStoragePath : string;
async function downloadImages(fields: any) : Promise<void> {

	// Ensure the global storage path exists
	if (!fs.existsSync(globalStoragePath)) {
		fs.mkdirSync(globalStoragePath, { recursive: true });
	}

	for (const attachment of fields.attachment as any ) {
		const filename = attachment.filename as string;
		if (filename.startsWith('image-')) {
			const imageURL = attachment.thumbnail as string;
			const imagePath = path.join(globalStoragePath,filename);
			if (fs.existsSync(imagePath))
				continue;
			log.appendLine(`saving ${imageURL} at ${imagePath}`);
			const response = await getImage(imageURL);
			if (!response)
				return;
			fs.writeFileSync(imagePath, response);
		}
	}
}

async function fetchIssueDetails(key: string): Promise<any> {
	const baseUrl = getConfigProperty('url');
	if (key == 'ISSUE-1234') {
		return undefined;
	}
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
		const fields = changeImageURL(response.data.fields);
		return fields;
	} catch (error) {
		const apiTokenPath = path.resolve(getConfigProperty('tokenPath'));
		vscode.window.showErrorMessage(`Unable to authenticate to ${baseUrl} with your PAT at ${apiTokenPath}`);
		return undefined;
	}
}

function parseIssueDetails(key: string, fields: any): string {
	if (key == "ISSUE-1234" ) {
		return `ISSUE-1234 | Status | Summary ( Assignee )`
	}
	if (fields === undefined) {
		throw new Error(`Can't find issue ${key}. (Check your PAT, the URL or your issue number)`)
	}

	let msg = `${key} |`;

	if (fields.status && fields.status.name as string)
		msg += ` ${fields.status.name} |`;

	if (fields.summary as string)
		msg += ` ${fields.summary}`;

	if (fields.assignee && fields.assignee.displayName as string)
		msg += ` ( ${fields.assignee.displayName} )`;

	return msg;
}

function changeImageURL(fields: any) : any {
	let imageDict: { [name: string]: string } = {};
	for (const attachment of fields.attachment as any ) {
		// if attachment.filename starts with 'image-', then
		const filename = attachment.filename as string;
		if (filename.startsWith('image-')) {
			// add attachments.thumbnail to the dictionnary
			imageDict[filename] = filename;
		}
	}

	// if fields.description contains !some-text|option!, then
	fields.description = fields.description.replace(/!([^|]+)(\|(?:.*))?!/g, (match:string, filename: string) => {
		// if some-text is dictionary key, then
		if (imageDict[filename]) {
			// replace some-text by the dictionary value associated with the some-text
			return `!vscode-file://vscode-app/${path.join(globalStoragePath,imageDict[filename])}!`;
		}
		return `!${match}!`;
	});
	return fields;
}

function getTooltip(label:string, fields: any): vscode.MarkdownString {
	const mdString = new vscode.MarkdownString();
	const baseUrl = getConfigProperty('url');
	mdString.appendMarkdown(`Click to open ${baseUrl}/browse/${label}\n\n`);
	if (label == 'ISSUE-1234') {
		mdString.appendMarkdown(`
__2 comments, 3 attachments__\n
---\n
This is the issue description, being rendered as **markdown**\n
It can span several lines, contains [url](https://some.where)
* or items
* or items too !
		`);
		return mdString;
	}
	if (fields !== undefined) {
		const ncomments = (fields.comment.comments as Array<any>).length;
		const nattach = (fields.attachment as Array<any>).length;
		mdString.appendMarkdown(`__${ncomments} comments, ${nattach} attachments__\n\n`);
		mdString.appendMarkdown('---\n\n');
		const markdown = j2m.to_markdown(fields.description);
		mdString.appendMarkdown(markdown);
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
		setConfigProperty('issue', issue, vscode.ConfigurationTarget.Workspace);
		let baseUrl = getConfigProperty('url');
		if (!baseUrl) {
			baseUrl = await changeUrl();
		}
		const fields = await fetchIssueDetails(issue);
		await downloadImages(fields);
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

function removeImagesInGlobalStorage() {
	// Currently only images are saved, so lets remove all files
	if (!fs.existsSync(globalStoragePath)) {
		return;
	}
	fs.readdirSync(globalStoragePath).forEach(file => {
		fs.rmSync(file);
	});
}

export function activate(context: vscode.ExtensionContext) {

	log = vscode.window.createOutputChannel(extensionName);
	console.log(`Congratulations, your extension ${extensionName} is now active!`);

	// Adding commands
	context.subscriptions.push(
		vscode.commands.registerCommand(extensionName+'.changeIssue',changeIssue)
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(extensionName+'.openIssueInBrowser',openIssueInBrowser)
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(extensionName+'.removeThumbnails',removeImagesInGlobalStorage)
	);

	// reload apiToken when option is changed
	vscode.workspace.onDidChangeConfiguration(event => {
		const affected = event.affectsConfiguration(extensionName+".tokenPath");
		if (affected) {
			apiToken = getApiToken();
		}
	})

	globalStoragePath = context.globalStorageUri.fsPath;

	// Verify we got the API token
	apiToken = getApiToken();
	if (!apiToken) {
		vscode.window.showErrorMessage('Unable to get API token.');
	}

	if (myStatusBarItem == undefined) {
		myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	}
	
	// Init the extension if label & url are already set
	let baseUrl = getConfigProperty('url');
	let label = getConfigProperty('issue');

	// Issue name is by default the current workspace basename
	if (!label) {
		let dirPath = "" ;
		if (vscode.workspace.workspaceFile) {
			dirPath = vscode.workspace.workspaceFile.fsPath;
		} else if (vscode.workspace.workspaceFolders) {
			dirPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		}
		label = path.basename(path.dirname(dirPath));
	}

	if (baseUrl && label)
	{
		const issue = label as string;
		const url = baseUrl as string;
		
		fetchIssueDetails(issue).then( (fields) => {
			downloadImages(fields).then(() => {});
			setStatusBar(issue,url,fields).then(() => {});
		});
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	removeImagesInGlobalStorage();
}
