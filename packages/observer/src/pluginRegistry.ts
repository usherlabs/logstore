import { Plugin, PluginOptions } from './Plugin';
import { ObserverPlugin } from './plugins/observer/ObserverPlugin';

export const createPlugin = (
	name: string,
	pluginOptions: PluginOptions
): Plugin<any> | never => {
	switch (name) {
		case 'observer':
			return new ObserverPlugin(pluginOptions);

		default:
			throw new Error(`Unknown plugin: ${name}`);
	}
};
