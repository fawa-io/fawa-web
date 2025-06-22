import {createPromiseClient} from "@connectrpc/connect";
import {FileService} from "../../gen/fawa/file/v1/file_connect.ts";
import {transport} from "../../common/transport.ts";

const client = createPromiseClient(FileService, transport);

export const fileApiClient = client;