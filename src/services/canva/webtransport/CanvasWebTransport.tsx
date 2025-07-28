import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CanvaRealtimeClient } from './client';
import type { DrawEvent, ClientDrawResponse } from './client';
import '../components/CanvasConsole.css';
import { Link } from 'react-router-dom';

const DEFAULT_CANVAS_HEIGHT = 500;
const COLORS = ['#222', '#e74c3c', '#3498db', '#2ecc71', '#f1c40f'];
const SIZES = [2, 4, 8, 16];
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const getRandomSize = () => SIZES[Math.floor(Math.random() * SIZES.length)];

export const CanvasWebTransport: React.FC<{ serverUrl: string }> = ({ serverUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState(getRandomColor());
  const [size, setSize] = useState(getRandomSize());
  const [isDrawing, setIsDrawing] = useState(false);
  const [client, setClient] = useState<CanvaRealtimeClient | null>(null);
  const [history, setHistory] = useState<DrawEvent[]>([]);
  const [status, setStatus] = useState('connecting');
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: DEFAULT_CANVAS_HEIGHT });

  // 会话相关状态
  const [sessionId, setSessionId] = useState<string>('');
  const [inputSessionId, setInputSessionId] = useState<string>('');
  const [showSessionInput, setShowSessionInput] = useState<boolean>(true);
  const [participants] = useState<number>(0); // 可后续扩展

  // Toast 通知
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  // 创建新会话
  const createSession = async () => {
    try {
      const resp = await fetch(`${serverUrl.replace(/\/webtransport\/canva.*/, '')}/create`, { method: 'POST' });
      const data = await resp.json();
      setSessionId(data.code);
      setShowSessionInput(false);
    } catch {
      showToast('网络错误，创建会话失败');
    }
  };

  // 加入会话
  const joinSession = async () => {
    if (inputSessionId.trim()) {
      const code = inputSessionId.trim().toUpperCase();
      try {
        const resp = await fetch(`${serverUrl.replace(/\/webtransport\/canva.*/, '')}/join?code=${code}`);
        if (resp.ok) {
          setSessionId(code);
          setShowSessionInput(false);
        } else {
          showToast('会话不存在！');
        }
      } catch {
        showToast('网络错误，加入会话失败');
      }
    }
  };

  // 复制会话ID到剪贴板
  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    showToast('会话ID已复制到剪贴板！');
  };

  // 画单个事件
  const drawEventOnCanvas = useCallback((event: DrawEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || event.type !== 'draw') return;
    ctx.strokeStyle = event.color || '#222';
    ctx.lineWidth = event.size || 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(event.prev_x!, event.prev_y!);
    ctx.lineTo(event.curr_x!, event.curr_y!);
    ctx.stroke();
  }, []);

  // 画布自适应容器宽度
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        setCanvasSize({ width, height: DEFAULT_CANVAS_HEIGHT });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 重绘历史
  // redraw已废弃，无需保留

  // 初始化连接
  useEffect(() => {
    if (!sessionId) return;
    // 拼接带code参数的WebTransport和WebSocket URL
    const base = serverUrl.replace(/\/webtransport\/canva.*/, '');
    const wtUrl = `${base}/webtransport/canva?code=${sessionId}`;
    const wsUrl = `${base}/ws/canva?code=${sessionId}`;
    const c = new CanvaRealtimeClient(wtUrl, wsUrl);
    setClient(c);
    c.onOpen(() => {
      setStatus('connected');
    });
    c.onClose(() => {
      setStatus('disconnected');
    });
    c.onMessage((msg: ClientDrawResponse) => {
      if (msg.initial_history) {
        setHistory(msg.initial_history.events);
        // 不再全量 redraw，直接依赖 setHistory
      } else if (msg.draw_event) {
        if (msg.draw_event.type === 'clear') {
          // 清空历史并清空画布
          setHistory([]);
    const ctx = canvasRef.current?.getContext('2d');
          ctx?.clearRect(0, 0, canvasSize.width, canvasSize.height);
        } else {
          setHistory((h) => {
            drawEventOnCanvas(msg.draw_event!);
            return [...h, msg.draw_event!];
          });
        }
      }
    });
    c.connect();
    return () => c.close();
  }, [serverUrl, sessionId, canvasSize, drawEventOnCanvas]);

  // 获取鼠标/触摸在画布上的坐标
  const getCanvasCoordinates = (e: React.PointerEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.PointerEvent).clientX;
      clientY = (e as React.PointerEvent).clientY;
    }
    // 计算相对于画布的坐标，考虑缩放
    const x = Math.round((clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((clientY - rect.top) * (canvas.height / rect.height));
    return { x, y };
  };

  // 处理鼠标/触摸按下事件
  const handlePointerDown = (e: React.PointerEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const pos = getCanvasCoordinates(e);
    lastPos.current = pos;
    if ('preventDefault' in e) e.preventDefault();
  };
  // 处理鼠标/触摸移动事件
  const handlePointerMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPos.current) return;
    const currentPos = getCanvasCoordinates(e);
    // 本地绘制，立即反馈
    drawEventOnCanvas({
      type: 'draw',
      color,
      size,
      prev_x: lastPos.current.x,
      prev_y: lastPos.current.y,
      curr_x: currentPos.x,
      curr_y: currentPos.y,
    });
    // 发送 draw_event
    client?.send({
      draw_event: {
        type: 'draw',
        color,
        size,
        prev_x: lastPos.current.x,
        prev_y: lastPos.current.y,
        curr_x: currentPos.x,
        curr_y: currentPos.y,
      },
    });
    lastPos.current = currentPos;
    if ('preventDefault' in e) e.preventDefault();
  };
  // 处理鼠标/触摸释放事件
  const handlePointerUp = (e?: React.PointerEvent | React.TouchEvent) => {
    setIsDrawing(false);
    lastPos.current = null;
    if (e && 'preventDefault' in e) e.preventDefault();
  };

  // 清空画布
  const handleClear = () => {
    client?.send({ draw_event: { type: 'clear' } });
  };

  // 监听 clear 事件，自动清空
  useEffect(() => {
    if (!history.length) return;
    const last = history[history.length - 1];
    if (last.type === 'clear') {
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.clearRect(0, 0, canvasSize.width, canvasSize.height);
    }
  }, [history, canvasSize]);

  // 会话选择界面
  if (showSessionInput) {
    return (
      <div className="canva-page-container">
        <Link to="/" className="canva-logo">FAWA</Link>
        <div className="session-choose-center">
          <div className="session-choose-card">
            <button className="big-create-btn" onClick={createSession}>🎨 创建新绘画</button>
          </div>
          <div className="session-choose-card join-card">
            <form onSubmit={e => { e.preventDefault(); joinSession(); }} className="join-form">
              <input
                type="text"
                placeholder="输入会话ID (6位字符)"
                value={inputSessionId}
                onChange={e => setInputSessionId(e.target.value)}
                maxLength={6}
                style={{ textTransform: 'uppercase' }}
                className="join-input-box"
              />
              <button type="submit" className="big-join-btn">加入绘画</button>
            </form>
          </div>
        </div>
        {toast && <div className="toast-tip">{toast}</div>}
      </div>
    );
  }

  // 画布界面
  return (
    <div className="canva-page-container">
      <Link to="/" className="canva-logo">FAWA</Link>
      <div className="session-info">
        <div className="session-id">
          <span>会话ID: {sessionId}</span>
          <button onClick={copySessionId} className="copy-btn">复制</button>
        </div>
        <div className="participants">
          <span>参与者: {participants}</span>
        </div>
      </div>
      <div className="canvas-controls">
        <span>状态: {status === 'connected' ? '已连接' : status === 'connecting' ? '连接中' : '已断开'}</span>
        <button onClick={handleClear}>清除画布</button>
        <div className="color-picker">
          <label>颜色:</label>
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
          />
        </div>
        <div className="size-picker">
          <label>线宽:</label>
          <input
            type="range"
            min={1}
            max={20}
            value={size}
            onChange={e => setSize(Number(e.target.value))}
          />
          <span>{size}px</span>
        </div>
      </div>
      <div className="canvas-container" ref={containerRef} style={{ height: DEFAULT_CANVAS_HEIGHT }}>
      <canvas
        ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
          style={{ touchAction: 'none' }}
      />
      </div>
      {toast && <div className="toast-tip">{toast}</div>}
    </div>
  );
};
