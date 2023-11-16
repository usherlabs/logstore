import { ethers } from 'ethers';
import { catchError, defer, map, share, throwError } from 'rxjs';

type GasStationResponse = {
	safeLow: {
		maxPriorityFee: number;
		maxFee: number;
	};
	standard: {
		maxPriorityFee: number;
		maxFee: number;
	};
	fast: {
		maxPriorityFee: number;
		maxFee: number;
	};
	estimatedBaseFee: number;
	blockTime: number;
	blockNumber: number;
};
const gasStationFees$ = defer(() =>
	fetch('https://gasstation.polygon.technology/v2').then(
		(response) => response.json() as Promise<GasStationResponse>
	)
).pipe(
	catchError((err) => {
		console.log('error fetching gas station fees: ', err);
		return throwError(() => err);
	})
);
const mapGweiToBN = (gwei: number) =>
	ethers.utils.parseUnits(gwei.toString(), 'gwei');

export const fastPriorityFee$ = gasStationFees$.pipe(
	map((gasStationResponse) => gasStationResponse.fast.maxPriorityFee),
	map(mapGweiToBN),
	share()
);
