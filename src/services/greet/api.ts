import { createClient } from "@connectrpc/connect";

import { GreetService } from "../../gen/fawa/greet/v1/hello_pb";

import { createConnectTransport } from "@connectrpc/connect-web";

const transport = createConnectTransport({
  baseUrl: import.meta.env.VITE_GREET_SERVICE_URL || 'https://3.149.9.32:8080',
});

const client = createClient(GreetService, transport);

export const greetClient = client;
