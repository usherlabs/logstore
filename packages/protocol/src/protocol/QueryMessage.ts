import UnsupportedTypeError from '../errors/UnsupportedTypeError';
import UnsupportedVersionError from '../errors/UnsupportedVersionError';
import { Serializer } from '../Serializer';
import { validateIsInteger, validateIsString } from '../utils/validations';

const serializerByVersionAndType: Record<
	string,
	Record<number, Serializer<QueryMessage>>
> = {};
const LATEST_VERSION = 1;

export enum QueryMessageType {
	QueryRequest = 0,
	QueryResponse = 1,
	QueryError = 2,
}

export interface QueryMessageOptions {
	version?: number;
	requestId: string;
}

export default class QueryMessage {
	static LATEST_VERSION = LATEST_VERSION;

	version: number;
	messageType: QueryMessageType;
	requestId: string;

	constructor(
		version = LATEST_VERSION,
		messageType: QueryMessageType,
		requestId: string
	) {
		if (new.target === QueryMessage) {
			throw new TypeError('QueryMessage is abstract.');
		}
		validateIsInteger('version', version);
		this.version = version;
		validateIsInteger('type', messageType);
		this.messageType = messageType;

		validateIsString('requestId', requestId, version < 2);
		this.requestId = requestId;
	}

	static registerSerializer(
		version: number,
		messageType: QueryMessageType,
		serializer: Serializer<QueryMessage>
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

	static unregisterSerializer(version: number, type: QueryMessageType): void {
		delete serializerByVersionAndType[version][type];
	}

	static getSerializer(
		version: number,
		type: QueryMessageType
	): Serializer<QueryMessage> {
		const serializersByType = serializerByVersionAndType[version];
		if (!serializersByType) {
			throw new UnsupportedVersionError(
				version,
				`Supported versions: [${QueryMessage.getSupportedVersions()}]`
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
			QueryMessage.getSerializer(version, this.messageType).toArray(
				this,
				...typeSpecificSerializeArgs
			)
		);
	}

	/**
	 * Takes a serialized representation (array or string) of a message, and returns a QueryMessage instance.
	 */
	static deserialize(
		msg: any,
		...typeSpecificDeserializeArgs: any[]
	): QueryMessage {
		const messageArray = typeof msg === 'string' ? JSON.parse(msg) : msg;

		const messageVersion = messageArray[0];
		const messageType = messageArray[1];

		const C = QueryMessage.getSerializer(messageVersion, messageType);
		return C.fromArray(messageArray, ...typeSpecificDeserializeArgs);
	}
}
