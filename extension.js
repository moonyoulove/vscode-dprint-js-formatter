const extensionName = "dprint";
const vscode = require('vscode');
const { createFromBuffer } = require("@dprint/formatter");
const { getPath } = require("@dprint/typescript");
const fs = require("fs");
const dprint = { formatter: null };

function setConfig(config = {}) {
	try {
		dprint.formatter.setConfig({}, config);
	} catch (error) {
		vscode.window.showErrorMessage("Failed to set config");
	}
}

function formatText(text) {
	try {
		return dprint.formatter.formatText("", text);
	} catch (error) {
		console.error("Failed to format text");
		return text;
	}
}

function findRange(text) {
	const lines = text.split(/(?<=\n)/);
	const start = lines.findIndex(line => line.match(/\S/));
	const end = lines.findLastIndex(line => line.match(/\S/)) + 1;
	return [
		lines.slice(0, start).join(""),
		lines.slice(start, end).join(""),
		lines.slice(end).join("")
	];
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const buffer = fs.readFileSync(getPath());
	dprint.formatter = createFromBuffer(buffer);
	const config = vscode.workspace.getConfiguration(extensionName).get("config");
	setConfig(config);

	context.subscriptions.push(
		vscode.languages.registerDocumentRangeFormattingEditProvider(["javascript", "typescript"], {
			provideDocumentRangeFormattingEdits(document, range) {
				const text = document.getText(range);
				const indent = text.match(/[ \t]*(?=\S)/);
				const [spaceBefore, body, spaceAfter] = findRange(text);
				const result = formatText(body).slice(0, -1).replaceAll(/^/gm, indent);
				return [new vscode.TextEdit(range, spaceBefore + result + spaceAfter)];
			}
		}),
		vscode.languages.registerDocumentFormattingEditProvider(["javascript", "typescript"], {
			provideDocumentFormattingEdits(document) {
				const text = document.getText();
				const range = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
				const result = formatText(text);
				return [new vscode.TextEdit(range, result)];
			}
		}),
		vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
			if (affectsConfiguration("dprint.config")) {
				const config = vscode.workspace.getConfiguration(extensionName).get("config");
				setConfig(config);
			}
		})
	);
}

function deactivate() {
	dprint.formatter = null;
}

module.exports = {
	activate,
	deactivate
};
