import { Option } from "@commander-js/extra-typings";
import { toEthereumAddress } from "@streamr/utils";
import { StorageNodeMetadata, } from "streamr-client";

export const metadataOption = new Option(
  '-m, --metadata <string>',
  `StorageProxy metadata representing its http endpoint. ie. { "http": "http://127.0.0.1:7171" }`
)
  .makeOptionMandatory()
  .argParser((value) => {
    return JSON.parse(value) as StorageNodeMetadata;
  });

export const nodeOption = new Option(
  '-n, --node <string>',
  `StorageProxy Node address`
)
  .makeOptionMandatory()
  .argParser((value) => {
    return toEthereumAddress(value);
  });
