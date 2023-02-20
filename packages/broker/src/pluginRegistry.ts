import { Plugin, PluginOptions } from './Plugin';
// import { HttpPlugin } from './plugins/http/HttpPlugin'
// import { ConsoleMetricsPlugin } from './plugins/consoleMetrics/ConsoleMetricsPlugin'
// import { WebsocketPlugin } from './plugins/websocket/WebsocketPlugin'
// import { MqttPlugin } from './plugins/mqtt/MqttPlugin'
import { LogStorePlugin } from './plugins/logStore/LogStorePlugin';
// import { BrubeckMinerPlugin } from './plugins/brubeckMiner/BrubeckMinerPlugin'
// import { SubscriberPlugin } from './plugins/subscriber/SubscriberPlugin'
// import { InfoPlugin } from './plugins/info/InfoPlugin'
// import { LogStorePlugin } from './plugins/logStore/LogStorePlugin'

export const createPlugin = (
	name: string,
	pluginOptions: PluginOptions
): Plugin<any> | never => {
	switch (name) {
		// case 'http':
		//     return new HttpPlugin(pluginOptions)
		// case 'consoleMetrics':
		//     return new ConsoleMetricsPlugin(pluginOptions)
		// case 'websocket':
		//     return new WebsocketPlugin(pluginOptions)
		// case 'mqtt':
		//     return new MqttPlugin(pluginOptions)
		case 'logStore':
			return new LogStorePlugin(pluginOptions);
		// case 'brubeckMiner':
		//     return new BrubeckMinerPlugin(pluginOptions)
		// case 'subscriber':
		//     return new SubscriberPlugin(pluginOptions)
		// case 'info':
		//     return new InfoPlugin(pluginOptions)
		// case 'logStore':
		//     return new LogStorePlugin(pluginOptions)
		default:
			throw new Error(`Unknown plugin: ${name}`);
	}
};
