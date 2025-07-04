
import { useGreetService } from '../hooks/useGreetService';
import './GreetConsole.css';

export function GreetConsole() {
    const {
        logs,
        clearLogs,
        runSayHello,
        runGreetStream,
        runGreetClientStream,
        runGreetBidiStream,
    } = useGreetService();

    const defaultName = "FAWA";

    return (
        <div className="greet-page-container">
            <div className="greet-main-content">
                <div className="fawa-logo">FAWA</div>
                <div className="button-container">
                    <button onClick={() => runSayHello(defaultName)}>SayHello (Unary)</button>
                    <button onClick={() => runGreetStream(defaultName)}>GreetStream (Server Stream)</button>
                    <button onClick={runGreetClientStream}>GreetClientStream (Client Stream)</button>
                    <button onClick={runGreetBidiStream}>GreetBidiStream (Bidi Stream)</button>
                </div>
            </div>
            <div className="logs-container">
                <div className="logs-header">
                    <h3>Logs</h3>
                    <button onClick={clearLogs}>Clear</button>
                </div>
                <pre className="logs">
                  {logs.map((log, i) => (
                      <div key={i}>{log}</div>
                  ))}
                </pre>
            </div>
        </div>
    );
}
