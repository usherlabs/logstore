import { ReportContractParams } from '../interfaces/report.common';
import { IReportV1, IReportV1Serialized } from '../interfaces/report.v1';

type IReport = IReportV1;
type IReportSerialized = IReportV1Serialized;

export abstract class ReportSerializer {
	abstract serialize(payload: IReport): IReportSerialized;

	abstract deserialize(payload: IReportSerialized): IReport;

	abstract toJSON(payload: IReport | IReportSerialized): string;

	abstract toContract(
		payload: IReport | IReportSerialized
	): ReportContractParams;
}
