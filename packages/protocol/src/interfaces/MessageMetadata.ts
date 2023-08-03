export interface MessageMetadata {
	/**
	 * Identifies the stream the message was published to.
	 */
	streamId: string;
	/**
	 * The partition number the message was published to.
	 */
	streamPartition: number;
	/**
	 * The timestamp of when the message was published.
	 */
	timestamp: number;
	/**
	 * Tiebreaker used to determine order in the case of multiple messages within a message chain having the same exact timestamp.
	 */
	sequenceNumber: number;
	/**
	 * Signature of message signed by publisher.
	 */
	signature: string;
	/**
	 * Publisher of message.
	 */
	publisherId: string;
	/**
	 * Identifies the message chain the message was published to.
	 */
	msgChainId: string;
}
