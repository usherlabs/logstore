import 'dotenv/config';

import { Arweave, Gzip, JsonFileCache } from '@kyve/core';
import Runtime from './runtime';
import { Node } from './node';

new Node()
	.addRuntime(new Runtime())
	.addStorageProvider(new Arweave())
	.addCompression(new Gzip())
	.addCache(new JsonFileCache())
	.start();
