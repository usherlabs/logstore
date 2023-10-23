import Runtime from './runtime';
import Validator from './validator';

const runtime = new Runtime();
export const validator = new Validator(runtime);
