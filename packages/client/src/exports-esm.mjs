// ESM EntryPoint
import LogStoreClient from './index.js';
export * from './index.js';
export { CONFIG_TEST } from './ConfigTest.js';
// required to get import LogStoreClient from '@logsn/streamr-client' to work
export default LogStoreClient.default;
// note this file is manually copied as-is into dist/src since we don't want tsc to compile it to commonjs
