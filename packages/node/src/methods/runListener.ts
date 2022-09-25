// import { sleep } from '@kyve/core/dist/src/utils';

import { ethers, EventFilter } from 'ethers';
import StreamrClient from 'streamr-client';
import { SupportedSources } from '@/types';

import type { Node } from '../node';

export async function runListener(this: Node): Promise<() => Promise<void>> {
	const polygonCache = await this.cache.newCache(SupportedSources.polygon);
	const ethereumCache = await this.cache.newCache(SupportedSources.ethereum);
	const streamrCache = await this.cache.newCache(SupportedSources.streamr);

	let polygonCacheHeight = await polygonCache.keys().count;
	let ethereumCacheHeight = await ethereumCache.keys().count;
	let streamrCacheHeight = await streamrCache.keys().count;

	// To unsubscribe from all streams -- https://github.com/streamr-dev/examples/blob/master/LightNodeJs/src/unsubscribeAll.js#L23
	const streamrClient = new StreamrClient({
		auth: {
			privateKey: this.evmPrivateKey,
		},
	});

	const setupListeners = async () => {
		const polygonFilters: EventFilter[] = [];
		const ethereumFilters: EventFilter[] = [];
		const streamrFilters: string[] = [];

		this.pipelines.forEach((p) => {
			p.sources.forEach((source) => {
				const [sourceIdentifier, sourceAddress, eventSelector = ''] = source;
				const eSel = eventSelector.split(' ').join('');
				switch (sourceIdentifier) {
					case SupportedSources.ethereum: {
						ethereumFilters.push({
							address: sourceAddress,
							topics: [ethers.utils.id(eSel)],
						});
						break;
					}
					case SupportedSources.polygon: {
						polygonFilters.push({
							address: sourceAddress,
							topics: [ethers.utils.id(eSel)],
						});
						break;
					}
					case SupportedSources.streamr: {
						streamrFilters.push(sourceAddress);
						break;
					}
					default: {
						break;
					}
				}
			});
		});

		if (this.connections.polygon.provider !== null) {
			await this.connections.polygon.provider.ready;
			this.logger.info('Polygon provider is ready to listen for events...');
			polygonFilters.forEach((filter) => {
				this.connections.polygon.provider.on(filter, async (event) => {
					polygonCache.put(polygonCacheHeight.toString(), event);
					polygonCacheHeight += 1;
				});
			});
			this.logger.info('Listening to Polygon events.');
		}
		if (this.connections.eth.provider !== null) {
			await this.connections.eth.provider.ready;
			this.logger.info('Ethereum provider is ready to listen for events...');
			ethereumFilters.forEach((filter) => {
				this.connections.eth.provider.on(filter, async (event) => {
					ethereumCache.put(ethereumCacheHeight.toString(), event);
					ethereumCacheHeight += 1;
				});
			});
			this.logger.info('Listening to Ethereum events.');
		}

		this.logger.info('Readying Steamr listeners...');
		const steamrListener = (message) => {
			streamrCache.put(streamrCacheHeight.toString(), message as any);
			streamrCacheHeight += 1;
		};
		for (let i = 0; i < streamrFilters.length; i += 1) {
			const filter = streamrFilters[i];
			const stream = await streamrClient.getStream(filter);
			await streamrClient.subscribe({ stream: stream.id }, steamrListener);
		}
	};

	const resetListeners = async () => {
		if (this.connections.polygon.provider !== null) {
			this.connections.polygon.provider.removeAllListeners();
		}
		if (this.connections.eth.provider !== null) {
			this.connections.eth.provider.removeAllListeners();
		}
		await streamrClient.unsubscribeAll();

		await setupListeners();
	};

	return resetListeners;
}
