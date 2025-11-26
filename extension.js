const vscode = require('vscode');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Check if a string looks like it contains Tailwind classes
 */
function looksLikeTailwindClasses(str) {
	if (!str || typeof str !== 'string') return false;

	const trimmed = str.trim();
	if (trimmed.length < 2) return false;

	const tokens = trimmed.split(/\s+/);

	const hasAtLeastOneTailwindToken = tokens.some((token) => {
		const parts = token.split(':');
		const utility = parts[parts.length - 1];

		return (
			utility.includes('-') ||
			utility.includes('[') ||
			[
				'flex',
				'grid',
				'block',
				'hidden',
				'inline',
				'absolute',
				'relative',
				'fixed',
				'sticky',
				'static',
				'container',
			].includes(utility)
		);
	});

	if (!hasAtLeastOneTailwindToken) return false;

	const tokensWithoutPattern = tokens.filter((t) => !t.includes('-') && !t.includes(':'));
	if (tokensWithoutPattern.length > 5) return false;

	return true;
}

/**
 * Tailwind utility detection
 */
function isTailwindClass(className) {
	const baseClass = className.startsWith('-') ? className.substring(1) : className;
	const prefixes = [
		'container',
		'box-',
		'block',
		'inline',
		'flex',
		'grid',
		'hidden',
		'basis-',
		'flex-',
		'grow',
		'shrink',
		'order-',
		'gap-',
		'justify-',
		'items-',
		'content-',
		'p-',
		'm-',
		'space-x-',
		'space-y-',
		'w-',
		'h-',
		'min-w-',
		'max-w-',
		'size-',
		'text-',
		'font-',
		'leading-',
		'tracking-',
		'line-clamp-',
		'uppercase',
		'lowercase',
		'truncate',
		'bg-',
		'from-',
		'via-',
		'to-',
		'border',
		'rounded',
		'ring-',
		'divide-',
		'shadow',
		'opacity-',
		'mix-blend-',
		'blur-',
		'invert',
		'saturate-',
		'sepia',
		'animate-',
		'transition',
		'duration-',
		'scale-',
		'rotate-',
		'translate-',
		'skew-',
		'cursor-',
		'pointer-events-',
		'scroll-',
		'touch-',
		'fill-',
		'stroke-',
		'static',
		'fixed',
		'absolute',
		'relative',
		'sticky',
		'top-',
		'bottom-',
		'left-',
		'right-',
		'inset-',
	];

	return prefixes.some((p) => baseClass.startsWith(p));
}

/**
 * Prefixing logic
 */
function applyPrefix(str, prefix) {
	if (!str) return '';

	const classes = str
		.trim()
		.split(/\s+/)
		.filter((c) => c.length > 0);

	const result = classes.map((cls) => {
		if (cls.startsWith(prefix)) return cls;

		const lastColon = cls.lastIndexOf(':');
		let v = '';
		let u = cls;

		if (lastColon !== -1) {
			v = cls.substring(0, lastColon + 1);
			u = cls.substring(lastColon + 1);
		}

		if (u.includes('[') && u.endsWith(']')) {
			const base = u.substring(0, u.indexOf('['));
			const arbitrary = u.substring(u.indexOf('['));

			if (!isTailwindClass(base)) return cls;

			return v + prefix + base + arbitrary;
		}

		if (!isTailwindClass(u)) return cls;
		return v + prefix + u;
	});

	return result.join(' ');
}

/**
 * Main activation
 */
function activate(context) {
	let disposable = vscode.commands.registerCommand('tailwindPrefixHelper.applyTsPrefix', async () => {
		const prefix = await vscode.window.showInputBox({
			prompt: 'Enter the Tailwind prefix you want to apply (e.g., ts-, custom-).',
			placeHolder: 'ts-',
			value: 'ts-',
			ignoreFocusOut: true,
			validateInput: (text) => (!text || text.trim() === '' ? 'Prefix cannot be empty.' : null),
		});

		if (!prefix) return;

		const editor = vscode.window.activeTextEditor;
		if (!editor) return vscode.window.showWarningMessage('No active editor.');

		const document = editor.document;
		const fullText = document.getText();
		const fileExt = document.fileName.split('.').pop().toLowerCase();

		let ast;
		let edits = [];

		try {
			const plugins = [
				'objectRestSpread',
				'classProperties',
				'optionalChaining',
				'nullishCoalescing',
				'dynamicImport',
				'classPrivateProperties',
				'topLevelAwait',
				'numericSeparator',
			];

			if (fileExt === 'tsx') {
				plugins.unshift(['typescript', { isTSX: true }], 'jsx');
			} else if (fileExt === 'ts') {
				plugins.unshift('typescript');
			} else if (fileExt === 'jsx' || fileExt === 'js') {
				plugins.unshift('jsx');
			}

			ast = parser.parse(fullText, {
				sourceType: 'module',
				plugins,
			});
		} catch (e) {
			return vscode.window.showErrorMessage('Parser error: ' + e.message);
		}

		traverse(ast, {
			StringLiteral(path) {
				const node = path.node;
				const raw = node.extra?.raw;

				if (!raw) return;
				const value = node.value;

				const parent = path.parent;
				const isCvaCn =
					parent.type === 'CallExpression' && (parent.callee?.name === 'cva' || parent.callee?.name === 'cn');

				const isObjProp = parent.type === 'ObjectProperty' && parent.value === node;

				if (!(isCvaCn || isObjProp)) return;
				if (!looksLikeTailwindClasses(value)) return;

				const newVal = applyPrefix(value, prefix);
				if (newVal === value) return;

				edits.push({
					start: node.start,
					end: node.end,
					newText: raw[0] + newVal + raw[raw.length - 1],
				});
			},

			JSXAttribute(path) {
				if (path.node.name.name !== 'className' && path.node.name.name !== 'class') return;

				const valueNode = path.node.value;
				if (!valueNode || valueNode.type !== 'StringLiteral') return;

				const raw = valueNode.extra?.raw;
				if (!raw) return;

				const value = valueNode.value;
				const newVal = applyPrefix(value, prefix);
				if (newVal === value) return;

				edits.push({
					start: valueNode.start,
					end: valueNode.end,
					newText: raw[0] + newVal + raw[raw.length - 1],
				});
			},
		});

		if (edits.length === 0) {
			return vscode.window.showInformationMessage('No un-prefixed Tailwind class strings found.');
		}

		edits.sort((a, b) => b.start - a.start);

		await editor.edit((editBuilder) => {
			for (const e of edits) {
				const range = new vscode.Range(document.positionAt(e.start), document.positionAt(e.end));
				editBuilder.replace(range, e.newText);
			}
		});

		vscode.window.showInformationMessage(`Successfully applied prefix to ${edits.length} class string(s)!`);
	});

	context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
