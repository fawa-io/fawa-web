import { createClient } from "@connectrpc/connect";
import { FileService } from "../../gen/fawa/file/v1/file_pb";
import { transport } from "../../common/transport.ts";

const client = createClient(FileService, transport);

export const fileClient = client;

