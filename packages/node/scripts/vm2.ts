import { NodeVM } from 'vm2';

const vm = new NodeVM({
	console: 'off',
	sandbox: {},
	require: false,
});

const fn = vm.run(
	'module.exports=(e=>({response:{hello:"world", exec: e.func()}}));'
);

(async () => {
	const resp = fn({
		func() {
			return 'awesome!';
		},
	});
	console.log(resp);
})();
