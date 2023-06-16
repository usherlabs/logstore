// import { python } from 'pythonia';
// (async () => {
// 	const etl = await python('ethereum-etl');
// 	console.log(etl);
// })();
// import { PythonShell } from 'python-shell';
// const py = new PythonShell('ethereumetl', {
// 	args: [
// 		'stream',
// 		'-s',
// 		'116500',
// 		'-e',
// 		'block',
// 		'-p',
// 		'http://localhost:8546',
// 	],
// });
// py.on('message', (msg) => {
// 	console.log(msg);
// });
// // end the input stream and allow the process to exit
// py.end(function (err, code, signal) {
// 	if (err) throw err;
// 	console.log('The exit code was: ' + code);
// 	console.log('The exit signal was: ' + signal);
// 	console.log('finished');
// });
import shell from 'shelljs';

if (!shell.which('ethereumetl')) {
	shell.echo(
		'ethereumetl is not installed. Please re-install the Log Store Validator, or run `pip install ethereum-etl`'
	);
	shell.exit(1);
}
const savefile = `.logstore-last_synced_block.txt`;
shell.rm(savefile);
const child = shell.exec(
	`ethereumetl stream -s 124773 -e block -p http://localhost:8546 -l ${savefile}`,
	{ async: true, silent: true, fatal: true },
	function (code, stdout, stderr) {
		console.log('Exit code:', code);
		console.log('Program output:', stdout);
		console.log('Program stderr:', stderr);
	}
);
child.stderr.on('data', (data) => {
	process.stderr.write(data);
});
child.stdout.on('data', (data) => {
	// process.stdout.write(data);
	try {
		if (data.includes(`"type": "block"`)) {
			const block = JSON.parse(data);
			console.log(block.number, block.timestamp);
		}
	} catch (e) {
		// ...
	}
});
