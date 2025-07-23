import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import { GreetConsole } from './services/greet/components/GreetConsole';
import { FileConsole } from './services/file/components/FileConsole';
import { CanvasConsole } from './services/canva/components/CanvasConsole';
import DownloadHandler from './components/DownloadHandler';
import NotFound from './components/NotFound';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/greet" element={<GreetConsole />} />
          <Route path="/file" element={<FileConsole />} />
          <Route path="/canvas" element={<CanvasConsole />} />
          <Route path="/download" element={<DownloadHandler />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
