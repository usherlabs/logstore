# **Log Store Benchmarks**

This package provides a benchmarking tool for the Log Store Network. It's built with Vitest and Tinybench, and allows running benchmarks either as normal Vitest tests or through a Command Line Interface (CLI).

## **Architecture**

- **Vitest**: Used for running the benchmarks as tests.
- **Tinybench**: Utilized for measuring performance.

## **Dependencies**

Ensure that you have installed all the dependencies specified in the **`package.json`** file.

## **Running Benchmarks**

There are two ways to run benchmarks:

1. **As Normal Vitest Tests**: Run the benchmarks as normal Vitest tests by executing the following command:

```
pnpm benchmark
```

This command will run all **`*.benchmark.ts`** test files.

1. **(WIP): Using CLI Tool**: You can also run the benchmarks through the command line interface.

To run without installing globally:

```sh
pnpx @logsn/benchmarks run
```

Alternatively, install globally and then run from terminal:

```sh
pnpm install -g @logsn/benchmarks
logsn-benchmarks run
```

### **Output**

The benchmarks produce JSON output with statistics. The meaning of each stat can be found in the **[Tinybench documentation](https://github.com/tinylibs/tinybench#taskresult)**. When running as normal Vitest tests, the results are saved in the **`results`** directory.

Each benchmark produces two sets of results: Cold and Hot. Cold start tests are executed first with fewer iterations and mainly serve to warm up the process. Hot tests run immediately after. This distinction is necessary for analyzing the performance during the warmup phase.

Note: New results will override old results by test name. This means that it doesn't delete the last file, but instead replaces it with new results if the test name is equal.

### **Configurations**

- **Number of Iterations**: You can configure the number of iterations via the **`TEST_TIMEOUT`** environment variable for test mode, or through the appropriate argument when using the CLI.
- **Log Level**: You can set the log level by setting the **`LOG_LEVEL`** environment variable. Acceptable values include **`info`**, **`debug`**, **`error`**, **`fatal`**, **`silent`**, **`warn`**, **`trace`**. E.g., **`LOG_LEVEL='trace'`**.
- **Network URLs**: Network URLs (e.g., RPC) can be configured by setting the **`STREAMR_DOCKER_DEV_HOST`** environment variable or the corresponding CLI argument. For more details, refer to the **[config documentation](https://github.com/usherlabs/streamr-network/blob/main/packages/client/src/ConfigTest.ts)**.

## **CLI**

The benchmarking tool also offers a CLI which allows running benchmarks through the terminal. The CLI can be used to specify various options for the benchmark run.

The command to use the CLI is:

```sh
logsn-benchmarks run [options]
# or pnpx @logsn/benchmarks run [options] if not installed
```

### **Options**

- **`c, --config <string>`**: Specifies the config file. **Note**: This is not working currently.
- **`o, --outDir <string>`**: Specifies the output directory for the benchmark results. The default is **`./results`**.
- **`s, --streamrHost <string>`**: Specifies the Streamr host. The default is **`localhost`**.
- **`n, --numberOfIterations <number>`**: Specifies the number of iterations for the benchmark. The default is **`5`**.
- **`l, --logLevel <string>`**: Specifies the log level. Acceptable values are **`debug`**, **`info`**, **`warn`**, **`error`**, **`fatal`**, **`silent`**. The default is **`info`**.

### **Example Usage**

```sh
logsn-benchmarks run -o ./my-results -s my-streamr-host -n 10 -l debug
```

This example runs the benchmarks and saves the results in a directory named **`my-results`**. It uses **`my-streamr-host`** as the Streamr host, sets the number of iterations to **`10`**, and the log level to **`debug`**.

## **Development**

### **Building**

To build the project, run:

```sh
pnpm build
```

This will trigger the build script defined in **`build.ts`** using ESBuild.
