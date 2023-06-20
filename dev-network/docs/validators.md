# LogStore DevNetwork - Validators

## LogStore Validator # 1

| Properby                 | Value                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Host                     | `logstore-validator-1`                                                             |
| ArWeave Address          | `8X1er8Bngza6g9dbndOgkWBFO93KkK8LeK8MXLCA3vk`                                      |
| ArWeave Mnemonic         | `woman multiply sleep regular fault fortune burst know walnut flower cry tiny`     |
| ArWeave Wallet           | [storage-1.json](../assets/arweave/storage-1.json)                                 |
| KYVE Validator Mnemonic  | `live inch guitar such upgrade sustain draw hip flight diagram heavy sniff`        |
| KYVE Valaccount Address  | `kyve1x25dgy4s9ukz27e7l5mfppvz4ysu3salc2dwmg`                                      |
| KYVE Valaccount Mnemonic | `nothing mechanic before hour other speak combine start pulse three paddle engage` |
| KYVE Valaccount Name     | `excellent-violet-hare`                                                            |
| EVM Address              | `0x3c9Ef7F26d7c1de4E67580cDB26A10f9b9a8b8C8`                                       |
| EVM Private Key          | `cc00000000000000000000000000000000000000000000000000000000000001`                 |

## LogStore Validator # 2

| Properby                 | Value                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Host                     | `logstore-validator-2`                                                              |
| ArWeave Address          | `SByfG2malxPboIymaaBtwiv3wkV-YJsNuT71IiDdm6A`                                       |
| ArWeave Mnemonic         | `okay subway van require once bean build diesel scheme session limb pulp`           |
| ArWeave Wallet           | [storage-2.json](../assets/arweave/storage-2.json)                                  |
| KYVE Validator Mnemonic  | `spoon dilemma roast glare elephant remain kingdom poverty empty dismiss fork idle` |
| KYVE Valaccount Address  | `kyve1n84w0s77pc5n543sndumztde84nvjstdt4alz2`                                       |
| KYVE Valaccount Mnemonic | `there fantasy gas live glide pig saddle canvas surface album joke arrange`         |
| KYVE Valaccount Name     | `drab-olive-antlion`                                                                |
| EVM Address              | `0x6596d2efeB1d2BB4b0f2a6Ef64594D01864F085e`                                        |
| EVM Private Key          | `cc00000000000000000000000000000000000000000000000000000000000002`                  |

## LogStore Validator # 3

| Properby                 | Value                                                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| Host                     | `logstore-validator-3`                                                         |
| ArWeave Address          | `Zcbf1xCblnJZRGhH-2XqJOzx1xbKNKS3ZVXfg5WaAGY`                                  |
| ArWeave Mnemonic         | `pink twin alley excess such loud add outdoor swing ridge stumble crime`       |
| ArWeave Wallet           | [storage-3.json](../assets/arweave/storage-3.json)                             |
| KYVE Validator Mnemonic  | `solid spring cotton good already board cover safe transfer appear idea chair` |
| KYVE Valaccount Address  | `kyve1d3aw230xwgzgd4ecdth7xvt0lvpw5xr4qeey5q`                                  |
| KYVE Valaccount Mnemonic | `chapter carpet veteran hotel inch real depth tribe define you fatigue pet`    |
| KYVE Valaccount Name     | `required-teal-aphid`                                                          |
| EVM Address              | `0x4798bf7bf01Bbd6D2E9DaE615727970ECDe56267`                                   |
| EVM Private Key          | `cc00000000000000000000000000000000000000000000000000000000000003`             |

---

## Validator Testing

### Kyve Kepler Wallet Setup

To access and setup Validators via the Kyve UI - `http://localhost:8801`, A Kepler Wallet must be configured.
Import the **KYVE Validator Mnemonic** keys, detailed above, into your Kyve Extension.

### Local Validator Operation

1. If you intend to operate a Validator Node from your Local Machine, be sure to clean any `.env` variables from your `packages/validator` directory.
2. Install `dotenv-cli` with `pnpm i -g dotenv-cli` to load the relevant `.env.validator-X` env files
3. As per the `dev-network/assets/validator/start-in-docker.sh` - Run the Validator Node with `dotenv` in a similar manner to the following:

```bash
dotenv -e ./.env.validator-1 -- ../../../packages/validator/dist/bin/logstore-validator.js start --pool 0 \
	--valaccount VALACCOUNT \
	--storage-priv STORAGE_PRIV \
	--chain-id kyve-local \
	--rpc http://logstore-kyve:26657 \
	--rest http://logstore-kyve:1317
```

_The above runs the Validator from the `dev-network/assets/validator` directory._

### Notes on Validator in DevNetwork

- Validator set to `restart: always` in Docker Compose
  - On second start, the actual Validator process will automatically start on the DevNetwork
  - To prevent this, edit the `docker-compose.yml` on the DevNetwork to use `restart: on-failure`
- `restart: on-failure` will run only once, which means that the operation to stake and setup Validators will be performed without running the Validator Node.
- `logstore-validator-3` — may be commented out temporarily on DevNetwork to support testing.
- **Important**:
  - If the Validators fail thier setup, this can be done via the Kyve UI - `http://localhost:8801`
  - Be sure to activate the **Expert Mode** within the Kyve UI to setup Validators within the DevNetwork Kyve Pool
