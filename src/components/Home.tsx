
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div>
      <h1>主页</h1>
      <nav>
        <ul>
          <li>
            <Link to="/greet">Greet 服务</Link>
          </li>
          <li>
            <Link to="/file">File 服务</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Home;
