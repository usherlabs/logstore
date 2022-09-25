// const { create } = require('ipfs');
// const { toString, concat } = require('uint8arrays');
// const all = require('it-all');

// const address =
// 	'bafybeihh65rjxekik7kit3kkxxnpp7aebosryrgdhgcqf2wjbjfnyiktru/contract.js';

// (async () => {
// 	const node = await create({
// 		repo: '../../ipfs/scripts',
// 		start: false,
// 		silent: true,
// 	});
// 	await node.start();

// 	const data = concat(await all(node.get(address)));
// 	console.log(toString(data));
// })();
