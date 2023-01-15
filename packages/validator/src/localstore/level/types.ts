import type { AbstractSublevel } from 'abstract-level';
import type { ClassicLevel } from 'classic-level';

export type LevelSublevel = AbstractSublevel<
	ClassicLevel<string, string>,
	string | Buffer,
	string,
	string
>;
