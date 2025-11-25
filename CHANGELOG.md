Change Log

All notable changes to the "Tailwind Prefix" extension will be documented in this file.

[1.0.0] - 2025-11-23

Added

Initial release of the Tailwind Prefix extension.

Core functionality to apply a custom prefix to Tailwind utility classes across the active file.

Uses AST parsing (Babel/Recast) for reliable code transformation in JS, JSX, and TS files.

Command to prompt user for prefix: Tailwind Prefix: Apply Prefix to File.

Automatic preservation of all Tailwind variants (hover:, md:, [a&]:, etc.).

Correctly skips non-class strings, such as variant names in defaultVariants.
