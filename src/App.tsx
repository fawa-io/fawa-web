import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import { GreetConsole } from './services/greet/components/GreetConsole';
import { FileConsole } from './services/file/components/FileConsole';
import DownloadHandler from './components/DownloadHandler'; // 导入 DownloadHandler
import NotFound from './components/NotFound'; // 导入 NotFound 组件
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/greet" element={<GreetConsole />} />
          <Route path="/file" element={<FileConsole />} />
          <Route path="/download" element={<DownloadHandler />} /> {/* 添加新的路由 */}
          <Route path="*" element={<NotFound />} /> {/* 捕获所有未匹配的路由 */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;

// import { FileConsole } from './services/file/components/FileConsole';
// import './App.css';
//
// function App() {
// 	return (
// 		<div className="App">
// 			<FileConsole />
// 		</div>
// 	);
// }
//
// export default App;
//
