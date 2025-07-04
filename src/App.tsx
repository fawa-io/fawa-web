import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import { GreetConsole } from './services/greet/components/GreetConsole';
import { FileConsole } from './services/file/components/FileConsole';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/greet" element={<GreetConsole />} />
          <Route path="/file" element={<FileConsole />} />
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
