import { createClient } from "@connectrpc/connect";

import { GreetService } from "../../gen/fawa/greet/v1/hello_pb";

import { transport } from "../../common/transport";

const client = createClient(GreetService, transport);

export const greetClient = client;
