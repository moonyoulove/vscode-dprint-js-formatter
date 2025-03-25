const extensionName = "dprint";
const vscode = require("vscode");
const { createFromBuffer } = require("@dprint/formatter");
const { getPath } = require("@dprint/typescript");
const fs = require("fs");
const dprint = {};

function setConfig(config = {}) {
    try {
        dprint.formatter.setConfig({}, config);
    } catch (error) {
        vscode.window.showErrorMessage("Failed to set config");
    }
}

function formatText(text, language) {
    try {
        const filePath = {
            "javascript": "*.js",
            "typescript": "*.ts",
            "javascriptreact": "*.jsx",
            "typescriptreact": "*.tsx",
        }[language];
        return dprint.formatter.formatText({ filePath, fileText: text });
    } catch (error) {
        console.error("Failed to format text");
        return text;
    }
}

function findRange(text) {
    const lines = text.split(/(?<=\n)/);
    const start = lines.findIndex((line) => line.match(/\S/));
    const end = lines.findLastIndex((line) => line.match(/\S/)) + 1;
    return [
        lines.slice(0, start).join(""),
        lines.slice(start, end).join(""),
        lines.slice(end).join(""),
    ];
}

function getBytesRange(document, range) {
    const documentStart = new vscode.Position(0, 0);
    const start = Buffer.byteLength(document.getText(new vscode.Range(documentStart, range.start)));
    const end = Buffer.byteLength(document.getText(range.with(documentStart)));
    return [start, end];
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const buffer = fs.readFileSync(getPath());
    dprint.formatter = createFromBuffer(buffer);
    const config = vscode.workspace.getConfiguration();
    setConfig(config.get("dprint-js-formatter.config"));

    context.subscriptions.push(
        vscode.languages.registerDocumentRangeFormattingEditProvider(["javascript", "typescript", "javascriptreact", "typescriptreact"], {
            provideDocumentRangeFormattingEdits(document, range) {
                const text = document.getText(range);
                const language = document.languageId;
                const indent = text.match(/[ \t]*(?=\S)/);
                const [spaceBefore, body, spaceAfter] = findRange(text);
                const result = formatText(body, language).slice(0, -1).replaceAll(/^/gm, indent);
                return [new vscode.TextEdit(range, spaceBefore + result + spaceAfter)];
            },
        }),
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(["javascript", "typescript", "javascriptreact", "typescriptreact"], {
            provideDocumentFormattingEdits(document) {
                const text = document.getText();
                const language = document.languageId;
                const range = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
                const result = formatText(text, language);
                return [new vscode.TextEdit(range, result)];
            },
        }),
    );

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (affectsConfiguration("dprint-js-formatter.config")) {
            const config = vscode.workspace.getConfiguration();
            setConfig(config.get("dprint-js-formatter.config"));
        }
    }));
}

function deactivate() {
    dprint.formatter = null;
}

module.exports = {
    activate,
    deactivate,
};
