import { parseIPFSURL } from "./helpers";

import { Web3Storage } from 'web3.storage';

function makeStorageClient() {
	return new Web3Storage({ token: process.env.WEB3_STORAGE_API_KEY });
}


/**
 * Fetches data from web3 storage
 * @param {string} cid the cid of the file as retrieved from the storage
 * @returns {string} returns the string representation of the object
 */
export async function fetchDataFromWeb3Storage(cid:string) {
	const client = makeStorageClient();
	const res = await client.get(cid);
	console.log(`Got a response! [${res.status}] ${res.statusText}`);
	if (!res.ok) {
		throw new Error(`failed to get ${cid}`);
	}

	const [file] = await res.files();
	return file.text();
}

/**
 * returns the corresponding JSON object from the ABI
 * @param abiURL {string} an ABI URL in the form ipfs://cid
 * @returns {Object} a json representaition of the ABI
 */
export async function retrieveABI(abiURL:string){
    const cid = parseIPFSURL(abiURL);
    const file = await fetchDataFromWeb3Storage(cid);
    return JSON.parse(file);
}
