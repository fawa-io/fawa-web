import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCanvaService } from '../hooks/useCanvaService';
import './CanvasConsole.css';

export function CanvasConsole() {
  const {
    logs,
    clearLogs,
    connect,
    disconnect,
    isConnected,
    canvasRef,
    drawSettings,
    setDrawSettings,
    sendDrawEvent,
    createDrawEvent,
    drawHistory,
    renderHistory,
  } = useCanvaService();

  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 设置画布大小
  useEffect(() => {
    if (canvasRef.current && containerRef.current) {
      const container = containerRef.current;
      
      // 设置画布的实际尺寸
      canvasRef.current.width = container.clientWidth;
      canvasRef.current.height = container.clientHeight;
      
      console.log(`Canvas尺寸设置为: ${canvasRef.current.width}x${canvasRef.current.height}`);
    }
  }, [canvasRef]);

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const container = containerRef.current;
        const currentCanvas = canvasRef.current;
        
        // 调整大小
        currentCanvas.width = container.clientWidth;
        currentCanvas.height = container.clientHeight;
        console.log(`Canvas大小调整为: ${currentCanvas.width}x${currentCanvas.height}`);
        
        // 根据历史记录重新绘制画布
        renderHistory(drawHistory);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [canvasRef, drawHistory, renderHistory]);

  // 获取鼠标/触摸在画布上的坐标
  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // 计算相对于画布的坐标
    const x = Math.round((clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((clientY - rect.top) * (canvas.height / rect.height));
    
    return { x, y };
  };

  // 处理鼠标/触摸按下事件
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isConnected) return;
    
    setIsDrawing(true);
    const pos = getCanvasCoordinates(e);
    setLastPos(pos);
    console.log(`绘制开始坐标: (${pos.x}, ${pos.y})`);
    
    // 防止触发默认行为
    e.preventDefault();
  };

  // 在本地绘制线条 - 为了立即显示反馈
  const drawLine = (prevX: number, prevY: number, currX: number, currY: number) => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = drawSettings.color;
    ctx.lineWidth = drawSettings.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // 绘制线条
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);
    ctx.stroke();
  };

  // 处理鼠标/触摸移动事件
  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isConnected || !isDrawing) return;
    
    const currentPos = getCanvasCoordinates(e);
    console.log(`绘制移动到: (${currentPos.x}, ${currentPos.y})`);
    
    // 本地绘制，立即显示反馈
    drawLine(lastPos.x, lastPos.y, currentPos.x, currentPos.y);
    
    // 创建并发送绘制事件
    const drawEvent = createDrawEvent(
      'draw',
      lastPos.x,
      lastPos.y,
      currentPos.x,
      currentPos.y
    );
    
    sendDrawEvent(drawEvent);
    setLastPos(currentPos);
    
    // 防止触发默认行为
    e.preventDefault();
  };

  // 处理鼠标/触摸释放事件
  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(false);
    console.log('绘制结束');
    
    // 防止触发默认行为
    e.preventDefault();
  };

  // 处理鼠标/触摸离开画布事件
  const handlePointerLeave = () => {
    if (isDrawing) {
      console.log('指针离开画布，绘制结束');
      setIsDrawing(false);
    }
  };

  // 处理颜色变化
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDrawSettings({
      ...drawSettings,
      color: e.target.value
    });
  };

  // 处理线宽变化
  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDrawSettings({
      ...drawSettings,
      size: parseInt(e.target.value)
    });
  };

  // 清除画布
  const clearCanvas = () => {
    if (!canvasRef.current || !isConnected) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // 本地清除
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    console.log('画布已本地清除');
    
    // 创建并发送清除事件
    // 使用一个特殊的"clear"类型事件，发送给所有客户端
    const clearEvent = createDrawEvent(
      'clear',  // 使用特殊的clear类型
      0, 0,     // 起始坐标不重要
      canvasRef.current.width, canvasRef.current.height  // 结束坐标用于传递画布尺寸
    );
    
    sendDrawEvent(clearEvent);
    console.log('清除事件已发送到服务器');
  };

  return (
    <div className="canva-page-container">
      <Link to="/" className="canva-logo">FAWA</Link>
      
      <div className="canvas-controls">
        <button 
          onClick={isConnected ? disconnect : connect}
          className={isConnected ? 'disconnect-button' : 'connect-button'}
        >
          {isConnected ? '断开连接' : '连接画布'}
        </button>
        
        <div className="color-picker">
          <label>颜色:</label>
          <input 
            type="color" 
            value={drawSettings.color}
            onChange={handleColorChange}
            disabled={!isConnected}
          />
        </div>
        
        <div className="size-picker">
          <label>线宽:</label>
          <input 
            type="range" 
            min="1" 
            max="20"
            value={drawSettings.size}
            onChange={handleSizeChange}
            disabled={!isConnected}
          />
          <span>{drawSettings.size}px</span>
        </div>
        
        <button 
          onClick={clearCanvas}
          disabled={!isConnected}
        >
          清除画布
        </button>
      </div>
      
      <div 
        className="canvas-container"
        ref={containerRef}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerLeave}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
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