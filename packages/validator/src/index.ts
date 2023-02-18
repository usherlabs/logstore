import 'dotenv/config';
import { Validator } from '@kyvejs/protocol';
import LogStore from './runtime';

const runtime = new LogStore();
const validator = new Validator(runtime);
validator.bootstrap();
