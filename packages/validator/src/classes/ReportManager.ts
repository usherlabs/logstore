import { abi as ReportManagerContractABI } from '@concertodao/logstore-contracts/artifacts/src/ReportManager.sol/LogStoreReportManager.json';
import { ethers } from 'ethers';

import { Report } from '../types';

export class ReportManagerContract {
	private _contract: ethers.Contract;

	constructor(provider: ethers.Provider, address: string) {
		this._contract = new ethers.Contract(address, ReportManagerContractABI, {
			provider,
		});
	}

	public get contract() {
		return this._contract;
	}

	async getLastReport() {
		const r = await this.contract.getLastReport();

		return r as Report;
	}
}
