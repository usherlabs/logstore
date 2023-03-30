import { abi as QueryManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/QueryManager.sol/LogStoreQueryManager.json';
import { ethers } from 'ethers';

export class QueryManagerContract {
	private _contract: ethers.Contract;

	constructor(provider: ethers.Provider, address: string) {
		this._contract = new ethers.Contract(address, QueryManagerContractABI, {
			provider,
		});
	}

	public get contract() {
		return this._contract;
	}
}
