**Change Log**

[1.1.2] - 2025-12-28

- Updated engines vscode to ^1.103.0

[1.1.1] - 2015-11-30

- Created separate file for tailwind classes

[1.1.0] - 2025-11-27

- Added support for renaming existing prefix with new one.

[1.0.4] - 2025-11-26

- Added auto prefix detection from tailwind.config.js file in the workspace. If a prefix is defined in the config, it will be suggested as the default prefix in the input box.

[1.0.3] - 2025-11-26

- Added keywords and categories to package.json for better discoverability in the VS Code marketplace.

[1.0.2] - 2025-11-26

- Updated logic to keep the formatting of class strings intact, preserving spaces and line breaks as in the original code.

[1.0.1] - 2025-11-26

- Updated github repository URL in package.json to the correct link.

[1.0.0] - 2025-11-23

- Initial release of the Tailwind Prefix extension.

- Core functionality to apply a custom prefix to Tailwind utility classes across the active file.

- Uses AST parsing (Babel/Recast) for reliable code transformation in JS, JSX, and TS files.

- Command to prompt user for prefix: Tailwind Prefix: Apply Prefix to File.

- Automatic preservation of all Tailwind variants (hover:, md:, [a&]:, etc.).

- Correctly skips non-class strings, such as variant names in defaultVariants.
