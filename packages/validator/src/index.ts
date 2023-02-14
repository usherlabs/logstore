import Node from './node';
import LogStore from './runtime';
import SystemMesh from './system';
import { events } from './utils/events';

const mesh = new SystemMesh();

const runtime = new LogStore(mesh);
const node = new Node(runtime);
events.once('config', (poolConfig) => {
	mesh.setSources(poolConfig.sources || []);
	mesh.start();
});
events.on('config', (poolConfig) => {
	mesh.setSources(poolConfig.sources || []);
});
node.bootstrap();
