import { ReportSerializer } from '../abstracts/ReportSerializer';
import { IReportV1, IReportV1Serialized } from '../interfaces/report.v1';
import { ReportSerializerVersions } from './ReportSerializerVersions';

const serializerByVersion: Record<string, ReportSerializer> = {};

const LATEST_VERSION = ReportSerializerVersions.V1;

type IReportAny = IReportV1 | IReportV1Serialized;

export class SystemReport {
	constructor(
		protected report: IReportAny,
		protected version = LATEST_VERSION
	) {
		if (report.v === ReportSerializerVersions.V1) {
			if (report.s === true) {
				this.report = report as IReportV1Serialized;
			} else {
				this.report = report as IReportV1;
			}
		}
	}

	private getSerializer() {
		if (typeof serializerByVersion[this.version] === 'undefined') {
			throw new Error('Invalid ReportSerializerVersion');
		}
		const serializer = serializerByVersion[this.version];
		return serializer;
	}

	serialize() {
		const serializer = this.getSerializer();
		return serializer.serialize(this.report);
	}

	deserialize() {
		const serializer = this.getSerializer();
		return serializer.deserialize(this.report);
	}

	toJSON() {
		const serializer = this.getSerializer();
		return serializer.toJSON(this.report);
	}

	toContract() {
		const serializer = this.getSerializer();
		return serializer.toContract(this.report);
	}

	static registerSerializer(
		version: ReportSerializerVersions,
		serializer: ReportSerializer
	): void {
		if (serializerByVersion[version] !== undefined) {
			throw new Error(
				`ReportSerializer for version ${version} is already registered: ${JSON.stringify(
					serializerByVersion[version]
				)}`
			);
		}
		serializerByVersion[version] = serializer;
	}

	static unregisterSerializer(version: ReportSerializerVersions): void {
		delete serializerByVersion[version];
	}
}
