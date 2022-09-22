import { Logger } from 'tslog';

import { appName } from '@/env-config';

export const logger = new Logger({ name: appName });
