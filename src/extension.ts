import * as vscode from 'vscode';

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function () {
	const tokenTypesLegend = [
		'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
		'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
		'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
	];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend = [
		'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
		'modification', 'async'
	];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerDocumentSemanticTokensProvider(
			{ language: 'haskell' },
			new DocumentSemanticTokensProvider(),
			legend
		)
	);
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

const reservedWords = [
	"case", "class", "data", "default", "deriving", "do", "else", "if",
	"import", "in", "infix", "infixl", "infixr", "instance", "let", "module",
	"newtype", "of", "then", "type", "where"
]

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const allTokens = this._parseText(document.getText());
		const builder = new vscode.SemanticTokensBuilder();
		allTokens.forEach((token) => {
			builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
		});
		return builder.build();
	}

	private _encodeTokenType(tokenType: string): number {
		if (tokenTypes.has(tokenType)) {
			return tokenTypes.get(tokenType)!;
		} else if (tokenType === 'notInLegend') {
			return tokenTypes.size + 2;
		}
		return 0;
	}

	private _encodeTokenModifiers(strTokenModifiers: string[]): number {
		let result = 0;
		for (let i = 0; i < strTokenModifiers.length; i++) {
			const tokenModifier = strTokenModifiers[i];
			if (tokenModifiers.has(tokenModifier)) {
				result = result | (1 << tokenModifiers.get(tokenModifier)!);
			} else if (tokenModifier === 'notInLegend') {
				result = result | (1 << tokenModifiers.size + 2);
			}
		}
		return result;
	}

	private _parseText(text: string): IParsedToken[] {
		const r: IParsedToken[] = [];
		const lines = text.split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length; i++) {
			let offset = 0;
			while (offset < lines[i].length) {
				let remain = lines[i].substring(offset);

				if ([' ', '\t', '\f'].includes(lines[i][offset])) {
    				offset++;
					continue;
				}

				if (lines[i].startsWith('--', offset)) {
					r.push({
						line: i,
						startCharacter: offset,
						length: lines[i].length - offset,
						tokenType: 'comment',
						tokenModifiers: ['documentation']
					});
					break;
				}

				let idMatch = remain.match(/^[a-zA-Z][a-zA-Z0-9]*/);
				if (idMatch) {
					if (reservedWords.includes(idMatch[0])) {
						r.push({
							line: i,
							startCharacter: offset,
							length: idMatch[0].length,
							tokenType: 'keyword',
							tokenModifiers: ["modification"]
						});
					}
					else if (idMatch[0].match(/^[A-Z]/)) {
						r.push({
							line: i,
							startCharacter: offset,
							length: idMatch[0].length,
							tokenType: 'type',
							tokenModifiers: ['declaration']
						});
					}
					else {
						r.push({
							line: i,
							startCharacter: offset,
							length: idMatch[0].length,
							tokenType: 'parameter',
							tokenModifiers: ['declaration']
						});
					}
					offset += idMatch[0].length;
					continue;
				}

				let numberMatch = remain.match(/^[0-9]+/);
				if (numberMatch) {
					r.push({
						line: i,
						startCharacter: offset,
						length: numberMatch[0].length,
						tokenType: 'number',
						tokenModifiers: ['static']
					});
					offset += numberMatch[0].length;
					continue;
				}

				offset++;
				continue;
			}
		}
		return r;
	}
}
