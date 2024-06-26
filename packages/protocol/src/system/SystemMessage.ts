import { Serializer } from '../abstracts/Serializer';
import UnsupportedTypeError from '../errors/UnsupportedTypeError';
import UnsupportedVersionError from '../errors/UnsupportedVersionError';
import { validateIsInteger } from '../utils/validations';
import type { QueryPropagate } from './QueryPropagate';
import type { QueryRequest } from './QueryRequest';
import type { QueryResponse } from './QueryResponse';

const serializerByVersionAndType: Record<
	string,
	Record<number, Serializer<SystemMessage>>
> = {};
const LATEST_VERSION = 1;

export enum SystemMessageType {
	QueryRequest = 1,
	QueryResponse = 2,
	QueryPropagate = 3,
}

export type SystemMessageMap = {
	[SystemMessageType.QueryRequest]: QueryRequest;
	[SystemMessageType.QueryResponse]: QueryResponse;
	[SystemMessageType.QueryPropagate]: QueryPropagate;
};

export interface SystemMessageOptions {
	version?: number;
	seqNum?: number;
}

export class SystemMessage {
	static LATEST_VERSION = LATEST_VERSION;

	public readonly version: number;
	public readonly messageType: SystemMessageType;
	public readonly seqNum: number;

	constructor(
		version = LATEST_VERSION,
		messageType: SystemMessageType,
		seqNum: number
	) {
		if (new.target === SystemMessage) {
			throw new TypeError('SystemMessage is abstract.');
		}
		validateIsInteger('version', version);
		this.version = version;
		validateIsInteger('type', messageType);
		this.messageType = messageType;
		this.seqNum = seqNum;
	}

	static registerSerializer(
		version: number,
		messageType: SystemMessageType,
		serializer: Serializer<SystemMessage>
	): void {
		// Check the serializer interface
		if (!serializer.fromArray) {
			throw new Error(
				`Serializer ${JSON.stringify(
					serializer
				)} doesn't implement a method fromArray!`
			);
		}
		if (!serializer.toArray) {
			throw new Error(
				`Serializer ${JSON.stringify(
					serializer
				)} doesn't implement a method toArray!`
			);
		}

		if (serializerByVersionAndType[version] === undefined) {
			serializerByVersionAndType[version] = {};
		}
		if (serializerByVersionAndType[version][messageType] !== undefined) {
			throw new Error(
				`Serializer for version ${version} and type ${messageType} is already registered: ${JSON.stringify(
					serializerByVersionAndType[version][messageType]
				)}`
			);
		}
		serializerByVersionAndType[version][messageType] = serializer;
	}

	static unregisterSerializer(version: number, type: SystemMessageType): void {
		delete serializerByVersionAndType[version][type];
	}

	static getSerializer(
		version: number,
		type: SystemMessageType
	): Serializer<SystemMessage> {
		const serializersByType = serializerByVersionAndType[version];
		if (!serializersByType) {
			throw new UnsupportedVersionError(
				version,
				`Supported versions: [${SystemMessage.getSupportedVersions()}]`
			);
		}
		const clazz = serializersByType[type];
		if (!clazz) {
			throw new UnsupportedTypeError(
				type,
				`Supported types: [${Object.keys(serializersByType)}]`
			);
		}
		return clazz;
	}

	static getSupportedVersions(): number[] {
		return Object.keys(serializerByVersionAndType).map((key) =>
			parseInt(key, 10)
		);
	}

	serialize(
		version = this.version,
		...typeSpecificSerializeArgs: any[]
	): string {
		return JSON.stringify(
			SystemMessage.getSerializer(version, this.messageType).toArray(
				this,
				...typeSpecificSerializeArgs
			)
		);
	}

	/**
	 * Takes a serialized representation (array or string) of a message, and returns a SystemMessage instance.
	 */
	static deserialize(
		msg: any,
		...typeSpecificDeserializeArgs: any[]
	): SystemMessage {
		const messageArray = typeof msg === 'string' ? JSON.parse(msg) : msg;

		const messageVersion = messageArray[0];
		const messageType = messageArray[1];

		const C = SystemMessage.getSerializer(messageVersion, messageType);
		return C.fromArray(messageArray, ...typeSpecificDeserializeArgs);
	}
}
