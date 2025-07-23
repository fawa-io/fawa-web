import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { CanvaService } from "../../gen/fawa/canva/v1/canva_pb";

const transport = createConnectTransport({
  baseUrl: import.meta.env.VITE_CANVA_SERVICE_URL || '/',
});

const client = createClient(CanvaService, transport);

export const canvaClient = client;
