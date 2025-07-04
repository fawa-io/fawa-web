import { createClient } from "@connectrpc/connect";

import { GreetService } from "../../gen/fawa/greet/v1/hello_pb";

import { createConnectTransport } from "@connectrpc/connect-web";

const transport = createConnectTransport({
  baseUrl: import.meta.env.VITE_GREET_SERVICE_URL || '/',
});

const client = createClient(GreetService, transport);

export const greetClient = client;
