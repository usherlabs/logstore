import { Pipeline } from "../types";
import { DUMMY_PIPELINE_DATA } from "../utils/dummy";

/**
 * Gets the several pipeline configurations present in the smart contract which collects them
 * 
 * @method fetchPipelines
 * @returns {Promise<Pipeline[]>}
 */
export async function fetchPipelines(): Promise<Pipeline[]>{
    //TODO implement the steps below
    // STEP 1: use ethers js to connect with the contract
    // STEP 2: call the method on the contract in order to fetch
    // return the data as gotten from the smart contract
    return DUMMY_PIPELINE_DATA;
}