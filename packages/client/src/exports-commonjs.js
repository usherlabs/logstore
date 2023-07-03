/* eslint-disable @typescript-eslint/no-require-imports */
// CJS entrypoint.
const LogStoreClientExports = require('./exports');

Object.assign(LogStoreClientExports.LogStoreClient, LogStoreClientExports);

// required to get require('~streamr-client') instead of require('~streamr-client').default
module.exports = LogStoreClientExports.LogStoreClient;
