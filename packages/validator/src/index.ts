import 'dotenv/config';

import Runtime from './runtime';
import Validator from './validator';

const runtime = new Runtime();
const validator = new Validator(runtime);
validator.bootstrap();
