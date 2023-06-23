import { QueryResponseMessage } from '@/types';

// go through all the responses recieved and verify using the content.hash property
// to find a consesnus of all the responses recieved the listener for a particular request
export function fetchQueryResponseConsensus(arr: QueryResponseMessage[]) {
	const result: Record<string, QueryResponseMessage[]> = {};
	let maxHash = '';
	let maxCount = -1;

	// Filter to ensure that each publisher only produces a single query response
	const filtered: QueryResponseMessage[] = [];
	arr.forEach((obj) => {
		if (
			!filtered
				.map((o) => o.metadata.publisherId)
				.includes(obj.metadata.publisherId)
		) {
			filtered.push(obj);
		}
	});

	// Produce a maxCount of a hash - and base the decision of consensus for a query response on this -- ie. the response that most nodes agreed to.
	filtered.forEach((obj) => {
		const hash = obj.content.hash;
		if (!result[hash]) {
			result[hash] = [obj];
		} else {
			result[hash].push(obj);
		}
		if (result[hash].length > maxCount) {
			maxCount = result[hash].length;
			maxHash = hash;
		}
	});
	return { result, maxHash, maxCount };
}
