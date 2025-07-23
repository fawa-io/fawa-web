
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="home-container">
      <div className="fawa-logo-home">FAWA</div>
      <h1>欢迎使用 Fawa</h1>
      <nav>
        <ul className="service-list">
          <li>
            <Link to="/greet" className="service-link">Greet 服务</Link>
          </li>
          <li>
            <Link to="/file" className="service-link">File 服务</Link>
          </li>
          <li>
            <Link to="/canvas" className="service-link">协同画布服务</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Home;
