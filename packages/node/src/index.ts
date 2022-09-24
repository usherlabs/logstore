import 'dotenv/config';

import { Arweave, Gzip } from '@kyve/core';
import Runtime from './runtime';
import { Node } from './node';
import { LevelStore } from './store';

new Node()
	.addRuntime(new Runtime())
	.addStorageProvider(new Arweave())
	.addCompression(new Gzip())
	.addCache(new LevelStore())
	.start();
