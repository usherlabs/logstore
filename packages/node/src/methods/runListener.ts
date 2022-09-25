// import { sleep } from '@kyve/core/dist/src/utils';

import { ethers, EventFilter } from 'ethers';
import StreamrClient from 'streamr-client';
import { SupportedSources } from '@/types';

import type { Node } from '../node';

export async function runListener(this: Node): Promise<() => Promise<void>> {
	let polygonCacheHeight = await this.sourceCache.polygon.height;
	let ethereumCacheHeight = await this.sourceCache.ethereum.height;
	let streamrCacheHeight = await this.sourceCache.streamr.height;

	// To unsubscribe from all streams -- https://github.com/streamr-dev/examples/blob/master/LightNodeJs/src/unsubscribeAll.js#L23
	const streamrClient = new StreamrClient({
		auth: {
			privateKey: this.evmPrivateKey,
		},
	});

	const setupListeners = async () => {
		const polygonFilters: { pipeline: string; filter: EventFilter }[] = [];
		const ethereumFilters: { pipeline: string; filter: EventFilter }[] = [];
		const streamrFilters: { pipeline: string; filter: string }[] = [];

		this.pipelines.forEach((p) => {
			p.sources.forEach((source) => {
				const [sourceIdentifier, sourceAddress, eventSelector = ''] = source;
				const eSel = eventSelector.split(' ').join('');
				switch (sourceIdentifier) {
					case SupportedSources.ethereum: {
						ethereumFilters.push({
							pipeline: p.id,
							filter: {
								address: sourceAddress,
								topics: [ethers.utils.id(eSel)],
							},
						});
						break;
					}
					case SupportedSources.polygon: {
						polygonFilters.push({
							pipeline: p.id,
							filter: {
								address: sourceAddress,
								topics: [ethers.utils.id(eSel)],
							},
						});
						break;
					}
					case SupportedSources.streamr: {
						streamrFilters.push({
							pipeline: p.id,
							filter: sourceAddress,
						});
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
			polygonFilters.forEach(({ pipeline, filter }) => {
				this.connections.polygon.provider.on(filter, async (event) => {
					this.sourceCache.polygon.put(polygonCacheHeight.toString(), {
						pipeline,
						event,
					});
					polygonCacheHeight += 1;
				});
			});
			this.logger.info('Listening to Polygon events.');
		}
		if (this.connections.eth.provider !== null) {
			await this.connections.eth.provider.ready;
			this.logger.info('Ethereum provider is ready to listen for events...');
			ethereumFilters.forEach(({ pipeline, filter }) => {
				this.connections.eth.provider.on(filter, async (event) => {
					this.sourceCache.ethereum.put(ethereumCacheHeight.toString(), {
						pipeline,
						event,
					});
					ethereumCacheHeight += 1;
				});
			});
			this.logger.info('Listening to Ethereum events.');
		}

		this.logger.info('Readying Steamr listeners...');
		const steamrListener = (pipeline) => (message) => {
			this.sourceCache.streamr.put(streamrCacheHeight.toString(), {
				pipeline,
				event: message as any,
			});
			streamrCacheHeight += 1;
		};
		for (let i = 0; i < streamrFilters.length; i += 1) {
			const { pipeline, filter } = streamrFilters[i];
			const stream = await streamrClient.getStream(filter);
			await streamrClient.subscribe(
				{ stream: stream.id },
				steamrListener(pipeline)
			);
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
