import { ReportSerializer } from '../abstracts/ReportSerializer';
import { ValidationError } from '../errors';
import { ReportSerializerVersions } from '../interfaces/report.common';
import { IReportV1, IReportV1Serialized } from '../interfaces/report.v1';

const serializerByVersion: Record<string, ReportSerializer> = {};

const LATEST_VERSION = ReportSerializerVersions.V1;

type IReport = IReportV1 | IReportV1Serialized;
export class SystemReport {
	constructor(protected report: IReport, protected version = LATEST_VERSION) {
		if (!('s' in report && 'v' in report)) {
			throw new ValidationError('Invalid Report Payload');
		}
		if (!ReportSerializerVersions[report.v]) {
			throw new ValidationError('Invalid Version');
		}
	}

	serialize() {
		const serializer = SystemReport.getSerializer(this.version);
		return serializer.serialize(this.report as IReportV1);
	}

	deserialize() {
		const serializer = SystemReport.getSerializer(this.version);
		return serializer.deserialize(this.report as IReportV1Serialized);
	}

	toJSON() {
		const serializer = SystemReport.getSerializer(this.version);
		return serializer.toJSON(this.report);
	}

	toContract() {
		const serializer = SystemReport.getSerializer(this.version);
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

	public static getSerializer(version: ReportSerializerVersions) {
		if (typeof serializerByVersion[version] === 'undefined') {
			throw new ValidationError('Invalid ReportSerializerVersion');
		}
		const serializer = serializerByVersion[version];
		return serializer;
	}

	static unregisterSerializer(version: ReportSerializerVersions): void {
		delete serializerByVersion[version];
	}

	static getVersionByNumber(versionNumber: number): ReportSerializerVersions {
		const res =
			ReportSerializerVersions[ReportSerializerVersions[versionNumber]];

		return res;
	}

	static getSupportedVersions(): number[] {
		const res = Object.values(ReportSerializerVersions)
			.filter((v) => typeof v === 'number')
			.map((v) => v as number);

		return res;
	}
}
