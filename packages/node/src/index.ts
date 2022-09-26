import 'dotenv/config';

import { Gzip } from '@kyve/core';
import Runtime from './runtime';
import { Node } from './node';
import { LevelStore } from './localstore';
import { Arweave } from './storage';

const node = new Node()
	.addRuntime(new Runtime())
	.addStorageProvider(new Arweave())
	.addCompression(new Gzip())
	.addCache(new LevelStore());

node.listen();
node.bootstrap();
