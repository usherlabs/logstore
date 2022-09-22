import { Node, Arweave, Gzip, JsonFileCache } from "@kyve/core";
import Runtime from "./runtime";

require("dotenv").config();

new Node()
	.addRuntime(new Runtime())
	.addStorageProvider(new Arweave())
	.addCompression(new Gzip())
	.addCache(new JsonFileCache())
	.start();
