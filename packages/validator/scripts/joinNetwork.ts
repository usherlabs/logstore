import KyveSDK from '@kyvejs/sdk';

const POOL_ID = '0';
const STAKE_AMOUNT = '10000000000';

const VALIDATOR_MNEMONIC = process.env.VALIDATOR_MNEMONIC;
const VALACCOUNT_ADDRESS = process.env.VALACCOUNT_ADDRESS;

const network = {
	rpc: 'http://logstore-kyve:26657',
	rest: 'http://logstore-kyve:1317',
	chainId: 'kyve-local',
	chainName: 'KYVE-LOCAL',
};
const sdk = new KyveSDK('kyve-local', network);

export async function joinNetwork() {
	const client = await sdk.fromMnemonic(VALIDATOR_MNEMONIC);
	const myAddress = client.account.address;

	const query = sdk.createLCDClient();
	const stakers = await query.kyve.query.v1beta1.stakersByPool({
		pool_id: POOL_ID,
	});
	const funded = await query.kyve.query.v1beta1.accountFundedList({
		address: myAddress,
	});
	const canValidate = await query.kyve.query.v1beta1.canValidate({
		pool_id: POOL_ID,
		valaddress: VALACCOUNT_ADDRESS,
	});
	const fundsToPool = funded.funded.find((f) => f.pool.id === POOL_ID);

	const alreadyStaker = myAddress in stakers.stakers;
	const alreadyFunder = fundsToPool && +fundsToPool.amount > 0;
	const alreadyJoined = canValidate.possible;

	if (!alreadyFunder) {
		console.log('Funding the Pool...');
		const fundPoolTx = await client.kyve.pool.v1beta1.fundPool({
			id: POOL_ID,
			amount: STAKE_AMOUNT,
		});
		await fundPoolTx.execute();
	}

	if (!alreadyStaker) {
		console.log('Creating a Staker...');
		const createStakerTx = await client.kyve.stakers.v1beta1.createStaker({
			commission: '10',
			amount: STAKE_AMOUNT,
		});
		await createStakerTx.execute();
	}

	if (!alreadyJoined) {
		console.log('Joining the Pool...');
		const joinPoolTx = await client.kyve.stakers.v1beta1.joinPool({
			pool_id: POOL_ID,
			valaddress: VALACCOUNT_ADDRESS,
			amount: STAKE_AMOUNT,
		});
		await joinPoolTx.execute();
	}
}
