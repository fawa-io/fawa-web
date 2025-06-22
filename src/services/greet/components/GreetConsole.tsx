import { useState } from 'react';
import { useGreetService } from '../hooks/useGreetService';
import './GreetConsole.css';

export function GreetConsole() {
    const [name, setName] = useState('World');

    const {
        logs,
        clearLogs,
        runSayHello,
        runGreetStream,
        runGreetClientStream,
        runGreetBidiStream,
    } = useGreetService();

    return (
        <>
            <h1>fawa Greet Service</h1>
            <div className="card">
                <label>
                    Name:
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
            </div>
            <div className="card">
                <button onClick={() => runSayHello(name)}>SayHello (Unary)</button>
                <button onClick={() => runGreetStream(name)}>GreetStream (Server Stream)</button>
                <button onClick={runGreetClientStream}>GreetClientStream (Client Stream)</button>
                <button onClick={runGreetBidiStream}>GreetBidiStream (Bidi Stream)</button>
            </div>
            <div className="card">
                <h3>Logs</h3>
                <button onClick={clearLogs} style={{ float: 'right' }}>Clear</button>
                <pre className="logs">
          {logs.map((log, i) => (
              <div key={i}>{log}</div>
          ))}
        </pre>
            </div>
        </>
    );
}