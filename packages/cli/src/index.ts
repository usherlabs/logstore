import { rootProgram } from '@/commands';

rootProgram.configureHelp({
	showGlobalOptions: true,
});

rootProgram.parse();
