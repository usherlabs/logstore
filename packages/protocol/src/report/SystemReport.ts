import { Signer } from '@ethersproject/abstract-signer';
import { arrayify } from '@ethersproject/bytes';

import { ReportSerializer } from '../abstracts/ReportSerializer';
import { ValidationError } from '../errors';
import { ReportSerializerVersions } from '../interfaces/report.common';
import { IReportV1, IReportV1Serialized } from '../interfaces/report.v1';
import { ProofOfReport } from '../system/ProofOfReport';

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

	public get id() {
		return this.report.id;
	}

	public get height() {
		return this.report.height;
	}

	public isSerialized() {
		return this.report.s;
	}

	public getVersion() {
		return this.version;
	}

	serialize() {
		if (this.report.s === true) {
			return this.report;
		}
		const serializer = SystemReport.getSerializer(this.version);
		return serializer.serialize(this.report as IReportV1);
	}

	deserialize() {
		if (this.report.s === false) {
			return this.report;
		}
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

	// ? Produce a hash based on the time of the ProofOfReport
	async toProof(
		signer: Signer,
		// ? Create a Timestamp for Proof Of Report - Compatible with On-Chain Verification
		// Tried using Streamr Message Timestamp, but hash/signature mechanism is difficult to replicate on-chain
		timestamp = Date.now()
	): Promise<ProofOfReport> {
		const toth = this.toHash(timestamp);
		// ? sign the hash + timestamp
		// Signatures verified on-chain require proofTimestamp relative to the signature to be concatenated to Contract Params Hash
		const signature = await signer.signMessage(arrayify(toth));

		return new ProofOfReport({
			hash: this.toHash(),
			address: await signer.getAddress(),
			toth, // Time-based one-time hash
			signature,
			timestamp,
		});
	}

	toHash(timestamp?: number) {
		const serializer = SystemReport.getSerializer(this.version);
		return serializer.toHash(this.report, timestamp);
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
