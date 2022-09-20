// import { Node, Arweave, Gzip, JsonFileCache } from "@etl-network/core";
import { Node, Arweave, Gzip, JsonFileCache } from "@kyve/core";
import EVM from "./runtime";

require('dotenv').config();

new Node()
	.addRuntime(new EVM())
	.addStorageProvider(new Arweave())
	.addCompression(new Gzip())
	.addCache(new JsonFileCache())
	.start();
