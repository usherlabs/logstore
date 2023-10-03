# @logsn/observer

## **Overview**

The Observer package is responsible for inspecting network activities and collecting telemetry data. It passively listens to network streams, gathers metrics, and forwards them to the Open Telemetry Collector for further processing and visualization via Grafana.

## **Key Features**

- **System Message Inspection**: Monitors and logs system messages like **`QueryRequest`**.
- **Bundle Reports**: Aggregates and summarizes bundle reports across the network.
- **High Configurability**: Similar configuration steps to the broker's setup.
- **Secure**: Future-proofed with private key configurations.

## **Quick Start**

### **Running Observer**

- **Development Mode**

```bash
pnpm run start:dev
```

- **Production Mode**

```bash
pnpm run start:prod
```


### **Environment Variables**

For custom configurations, you can set environment variables in a **`.env`** file within the Observer directory.

- **`CONFIG_PATH`**: Path to the Observer configuration file. (Default: **`~/.logstore/config/observer.json`**)
- **`TRACING_URL`**: URL for tracing data.
- **`METRICS_URL`**: URL for metrics data.

## **Configuration**

See the example configuration **[here](https://github.com/usherlabs/logstore/blob/main/dev-network/assets/observer/observer.json)**.

## **Deployment**

- Check the devnetwork **`docker-compose.yml`** file to inspect the Observer service configuration as an example.
- Ensure the necessary telemetry pipeline is properly configured and running for metrics and tracing. E.g., OpenTelemetry Collector, Prometheus, Tempo and Grafana.
- Always ensure your environment variables are correctly set for the deployment context (Dev or Prod).
