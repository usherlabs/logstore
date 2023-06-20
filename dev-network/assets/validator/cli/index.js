const { KyveSDK } = require("@kyvejs/sdk/dist/sdk");

const POOL_ID = "0";
const STAKE_AMOUNT = "10000000000";

async function main() {
  const VALIDATOR_MNEMONIC = process.env.VALIDATOR_MNEMONIC;
  const VALACCOUNT_ADDRESS = process.env.VALACCOUNT_ADDRESS;

  const network = {
    rpc: "http://logstore-kyve:26657",
    rest: "http://logstore-kyve:1317",
    chainId: "kyve-local",
    chainName: "KYVE-LOCAL",
  };

  const sdk = new KyveSDK("kyve-local", network);
  const client = await sdk.fromMnemonic(VALIDATOR_MNEMONIC);

  console.log("Funding the Pool...");
  const fundPoolTx = await client.kyve.pool.v1beta1.fundPool({
    id: POOL_ID,
    amount: STAKE_AMOUNT,
  });
  await fundPoolTx.execute();

  console.log("Creating a Staker...");
  const createStakerTx = await client.kyve.stakers.v1beta1.createStaker({
    commission: "10",
    amount: STAKE_AMOUNT,
  });
  await createStakerTx.execute();

  console.log("Joining the Pool...");
  const joinPoolTx = await client.kyve.stakers.v1beta1.joinPool({
    pool_id: POOL_ID,
    valaddress: VALACCOUNT_ADDRESS,
    amount: STAKE_AMOUNT,
  });
  await joinPoolTx.execute();
}

void main().then();
