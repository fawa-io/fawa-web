import { createClient } from "@connectrpc/connect";
import { FileService } from "../../gen/fawa/file/v1/file_pb";
import { createConnectTransport } from "@connectrpc/connect-web";

const transport = createConnectTransport({
  baseUrl: import.meta.env.VITE_FILE_SERVICE_URL || 'https://3.1949.9.32:8080',
});

const client = createClient(FileService, transport);

export const fileClient = client;

