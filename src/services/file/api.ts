import { createClient } from "@connectrpc/connect";
import { FileService } from "../../gen/file/v1/file_pb";
import { createConnectTransport } from "@connectrpc/connect-web";

const transport = createConnectTransport({
  baseUrl: import.meta.env.VITE_FILE_SERVICE_URL || '/',
});

const client = createClient(FileService, transport);

export const fileClient = client;

