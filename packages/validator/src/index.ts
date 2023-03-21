import 'dotenv/config';

import Listener from './listener';
import Runtime from './runtime';
import Validator from './validator';

const listener = new Listener();
const runtime = new Runtime();
const validator = new Validator(runtime, listener);
validator.bootstrap();
