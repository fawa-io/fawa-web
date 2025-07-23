import { Link } from 'react-router-dom';
import { useRef, useEffect } from 'react';
import { useCanvaService } from '../hooks/useCanvaService';
import './CanvasConsole.css';

export function CanvasConsole() {
  const {
    logs,
    clearLogs,
    isConnected,
    settings,
    setSettings,
    initializeCanvas,
    startDrawing,
    draw,
    finishDrawing,
    connect,
    disconnect,
    clearCanvas
  } = useCanvaService();

  const canvasElement = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasElement.current) {
      initializeCanvas(canvasElement.current);
    }
  }, [initializeCanvas]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasElement.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    startDrawing(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasElement.current;
    if (!canvas) return;
    
    const x = e.clientX;
    const y = e.clientY;
    
    draw(x, y);
  };

  const handleMouseUp = () => {
    finishDrawing();
  };

  const handleMouseLeave = () => {
    finishDrawing();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const touch = e.touches[0];
    const canvas = canvasElement.current;
    if (!canvas || !touch) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    startDrawing(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    const touch = e.touches[0];
    if (!touch) return;
    
    const x = touch.clientX;
    const y = touch.clientY;
    
    draw(x, y);
  };

  const handleTouchEnd = () => {
    finishDrawing();
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({
      ...prev,
      color: e.target.value
    }));
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({
      ...prev,
      size: parseInt(e.target.value, 10)
    }));
  };

  return (
    <div className="canvas-page-container">
      <div className="canvas-main-content">
        <Link to="/" className="fawa-logo">FAWA</Link>
        
        <div className="canvas-controls">
          <div className="connection-controls">
            <button 
              onClick={connect} 
              disabled={isConnected}
              className={isConnected ? "connected" : ""}
            >
              {isConnected ? "已连接" : "连接"}
            </button>
            <button 
              onClick={disconnect} 
              disabled={!isConnected}
            >
              断开连接
            </button>
          </div>
          
          <div className="drawing-controls">
            <div className="control-group">
              <label htmlFor="color-picker">颜色:</label>
              <input 
                id="color-picker" 
                type="color" 
                value={settings.color}
                onChange={handleColorChange}
                disabled={!isConnected} 
              />
            </div>
            
            <div className="control-group">
              <label htmlFor="brush-size">笔刷大小:</label>
              <input 
                id="brush-size" 
                type="range" 
                min="1" 
                max="20" 
                value={settings.size}
                onChange={handleSizeChange}
                disabled={!isConnected} 
              />
              <span>{settings.size}px</span>
            </div>
            
            <button 
              onClick={clearCanvas}
              disabled={!isConnected}
              className="clear-btn"
            >
              清除画布
            </button>
          </div>
        </div>
        
        <div className="canvas-container">
          <canvas
            ref={canvasElement}
            className="drawing-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          {!isConnected && (
            <div className="canvas-overlay">
              <p>请点击"连接"按钮开始绘制</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="logs-container">
        <div className="logs-header">
          <h3>日志</h3>
          <button onClick={clearLogs}>清除</button>
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
