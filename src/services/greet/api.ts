import {createPromiseClient} from "@connectrpc/connect";

import {GreetService} from "../../gen/fawa/greet/v1/hello_connect.ts";

import {transport} from "../../common/transport.ts"

const client = createPromiseClient(GreetService, transport)

export const greetApiClient = client
