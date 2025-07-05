
import { Link } from 'react-router-dom';
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
                <Link to="/" className="fawa-logo">FAWA</Link>
                <div className="button-container">
                    <button onClick={() => runSayHello(defaultName)}>Unary</button>
                    <button onClick={() => runGreetStream(defaultName)}>ServerStream</button>
                    <button onClick={runGreetClientStream}>ClientStream</button>
                    <button onClick={runGreetBidiStream}>BidiStream</button>
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
