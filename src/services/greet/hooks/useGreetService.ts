import { useState } from 'react';
import { greetApiClient } from '../api.ts';

export function useGreetService() {
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (message: string) => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const clearLogs = () => {
        setLogs([]);
    };

    const runSayHello = async (name: string) => {
        clearLogs();
        addLog('--- Unary RPC ---');
        addLog(`Sending: ${name}`);
        const response = await greetApiClient.sayHello({name});
        addLog(`Received: ${response.resp}`);
        addLog('--- Finished ---');
    };

    const runGreetStream = async (name: string) => {
        clearLogs();
        addLog('--- Server-Streaming RPC ---');
        addLog(`Sending request...`);
        try {
            for await (const response of greetApiClient.greetStream({name})) {
                addLog(`Received stream part: ${response.part}`);
            }
            addLog(`Server stream closed.`);
        } catch (e) {
            addLog(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
        addLog('--- Finished ---');
    };

    const runGreetClientStream = async () => {
        clearLogs();
        addLog('--- Client-Streaming RPC ---');
        const names = ['Alice', 'Bob', 'Charlie'];

        async function* sendNames() {
            for (const n of names) {
                addLog(`Sending stream part: ${n}`);
                yield {name: n};
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }

        addLog(`Client stream started...`);
        const response = await greetApiClient.greetClientStream(sendNames());
        addLog(`Server replied with summary: ${response.summary}`);
        addLog('--- Finished ---');
    };

    const runGreetBidiStream = async () => {
        clearLogs();
        addLog('--- Bidirectional-Streaming RPC ---');
        const names = ['ECHO-1', 'ECHO-2', 'ECHO-3'];

        async function* sendNames() {
            for (const n of names) {
                addLog(`Sending: ${n}`);
                yield {name: n};
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }

        addLog(`Bidi stream started...`);
        try {
            const stream = greetApiClient.greetBidiStream(sendNames());
            for await (const response of stream) {
                addLog(`Received: ${response.echo}`);
            }
            addLog(`Server stream closed.`);
        } catch (e) {
            addLog(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
        addLog('--- Finished ---');
    };
    return {
        logs,
        clearLogs,
        runSayHello,
        runGreetStream,
        runGreetClientStream,
        runGreetBidiStream,
    };
}