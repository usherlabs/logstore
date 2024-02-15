import * as globby from 'globby';
import * as path from 'path';
import * as fs from 'fs';

// REGEX REPLACEMENTS --------------------------------------------
// when using webpack, we need to replace the worker creation with a raw source import
// it is also configured to do so in the webpack.config.js
// .
// however, in nodejs we continue using the URL to create the worker
const replacement1 = {
	filePattern: 'workerHelpers.js',
	from: /const worker = new Worker\(\s*new URL\('(.+?)', import\.meta\.url\),\s*\{\s*type: 'module'\s*\}\s*\);/g,
	to: `const isBrowser = typeof window !== 'undefined';
      const { default: rawCode } = isBrowser ? await import(
        /* webpackMode: "eager" */
        '$1'
      ) : {};
      const url = rawCode ?  URL.createObjectURL(
        new Blob([rawCode], { type: 'application/javascript' }),
      ) : '$1';
      const worker = new Worker(url, {
        type: 'module',
      });
`,
};

// we're enforcing the input to be defined
const replacement2 = {
	to: 'throw new Error("This shouldn\'t be undefined")',
	from: /input = new URL\('(.+?)', import\.meta\.url\);/g,
	filePattern: 'tlsn_verify_rs.js',
};

// explicit import of tlsn_verify_rs reduces errors we got
const replacement3 = {
	from: "import initWbg, { wbg_rayon_start_worker } from '../../../';",
	to: "import initWbg, { wbg_rayon_start_worker } from '../../../tlsn_verify_rs';",
	filePattern: 'workerHelpers.worker.js',
};

const pkgPath = path.join(__dirname, '..', 'wasm/tlsn-verify-rs/pkg');

const runReplacement = (replacement: {
	filePattern: string;
	from: string;
	to: string;
}) => {
	const filePath = globby.globbySync(
		pkgPath + '/**/' + replacement.filePattern
	)[0];
	const fileContent = fs.readFileSync(filePath, 'utf8');
	const newContent = fileContent.replace(
		new RegExp(replacement.from, 'g'),
		replacement.to
	);
	fs.writeFileSync(filePath, newContent);
};

const replacements = [replacement1, replacement2, replacement3];

replacements.forEach(runReplacement);

// FIX PACKAGE.JSON --------------------------------------------
// adds *.wasm, *.d.ts and snippets/* to files in package.json
const runPackageJsonFix = () => {
	const packageJsonPath = path.join(pkgPath, 'package.json');
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	const toBeAdded = ['*.wasm', '*.d.ts', 'snippets/*'];
	packageJson.files = Array.from( new Set([...packageJson.files, ...toBeAdded]) );

	fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
};

runPackageJsonFix();

console.log('Fix wasm script ran successfully!');
