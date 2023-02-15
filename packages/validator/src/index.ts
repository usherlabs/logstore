import Validator from './validator';
import LogStore from './runtime';
import SystemMesh from './system';
import { events } from './utils/events';
import 'dotenv/config';

const mesh = new SystemMesh();

const runtime = new LogStore(mesh);
const validator = new Validator(runtime);
events.once('config', (poolConfig) => {
	const [source] = poolConfig.sources;
	mesh.setSource(source || '');
	mesh.start();

	events.on('config', (poolConfig) => {
		const [source] = poolConfig.sources;
		mesh.setSource(source || '');
	});
});
validator.bootstrap();
