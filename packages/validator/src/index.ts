import { Node } from '@kyve/core-beta';

import LogStore from './runtime';

const runtime = new LogStore();

const node = new Node(runtime);
node.bootstrap();

// TODO: Create second listener process for System Stream
