const vscode = require('vscode');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

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
 * Find nearest tailwind.config file searching upwards from a start path
 */
function findNearestConfigPath(startPath) {
	const configNames = ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.mjs', 'tailwind.config.ts'];
	let dir = path.dirname(startPath);

	const workspaceFolders = vscode.workspace.workspaceFolders;
	const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

	while (dir) {
		for (const name of configNames) {
			const p = path.join(dir, name);
			if (fs.existsSync(p)) return p;
		}
		if (workspaceRoot && dir === workspaceRoot) break;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	return null;
}

/**
 * Extract prefix value from config via import/require or fallback to regex parse
 */
async function getPrefixFromConfig(configPath) {
	if (!configPath) return null;

	const ext = path.extname(configPath).toLowerCase();

	// Try importing the config first (works for CJS/Esm; may fail on .ts)
	try {
		const mod = await import(pathToFileURL(configPath).href);
		const conf = mod && (mod.default ?? mod);
		if (conf && typeof conf.prefix === 'string' && conf.prefix.trim() !== '') {
			return conf.prefix;
		}
	} catch (e) {
		// fallback to require (common case for CJS)
		try {
			const conf = require(configPath);
			if (conf && typeof conf.prefix === 'string' && conf.prefix.trim() !== '') {
				return conf.prefix;
			}
		} catch (err) {
			// continue to regex fallback
		}
	}

	// Fallback: read file and find prefix with regex (works for .ts)
	try {
		const text = fs.readFileSync(configPath, 'utf8');
		const m = text.match(/prefix\s*:\s*(['"`])([^'"`]+?)\1/);
		if (m && m[2]) return m[2];
	} catch (e) {
		// ignore
	}

	return null;
}

/**
 * Main activation
 */
function activate(context) {
	let disposable = vscode.commands.registerCommand('tailwindPrefixHelper.applyTsPrefix', async () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return vscode.window.showWarningMessage('No active editor.');

		const document = editor.document;
		// detect prefix from nearest tailwind config
		let defaultPrefix = 'ts-';
		try {
			const configPath = findNearestConfigPath(document.uri.fsPath);
			const detected = await getPrefixFromConfig(configPath);
			if (detected && typeof detected === 'string' && detected.trim() !== '') defaultPrefix = detected;
		} catch (e) {
			console.error(e.message);
		}

		const prefix = await vscode.window.showInputBox({
			prompt: 'Enter the Tailwind prefix you want to apply (e.g., ts-, custom-).',
			placeHolder: 'ts-',
			value: defaultPrefix,
			ignoreFocusOut: true,
			validateInput: (text) => (!text || text.trim() === '' ? 'Prefix cannot be empty.' : null),
		});

		if (!prefix) return;

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
