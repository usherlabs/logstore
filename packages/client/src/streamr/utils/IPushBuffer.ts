import { Observable } from 'rxjs';

export type IPushBuffer<InType, OutType = InType> = {
	push(item: InType): Promise<boolean>;
	end(error?: Error): void;
	endWrite(error?: Error): void;
	length: number;
	isDone(): boolean;
	clear(): void;
} & AsyncGenerator<OutType>;

/**
 * Pull from a source into some PushBuffer
 */
export async function pull<InType, OutType = InType>(
	src: Observable<InType>,
	dest: IPushBuffer<InType, OutType>
): Promise<void> {
	if (!src) {
		throw new Error('no source');
	}

	try {
		for await (const v of src) {
			const ok = await dest.push(v);
			if (!ok) {
				break;
			}
		}
	} catch (err: any) {
		dest.endWrite(err);
	} finally {
		dest.endWrite();
	}
}
