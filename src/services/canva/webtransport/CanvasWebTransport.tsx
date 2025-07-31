import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CanvaRealtimeClient } from './client';
import type { DrawEvent, ClientDrawResponse } from './client';

// 常量定义
const DEFAULT_CANVAS_HEIGHT = 600;
const COLORS = ['#222222', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
const SIZES = [2, 4, 6, 8, 10, 12, 16, 20];

const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const getRandomSize = () => SIZES[Math.floor(Math.random() * SIZES.length)];

export const CanvasWebTransport: React.FC<{ serverUrl: string }> = ({ serverUrl }) => {
  // 状态管理
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState(getRandomColor());
  const [size, setSize] = useState(getRandomSize());
  const [isDrawing, setIsDrawing] = useState(false);
  const [client, setClient] = useState<CanvaRealtimeClient | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [history, setHistory] = useState<DrawEvent[]>([]);
  const [inputSessionId, setInputSessionId] = useState<string>('');
  const [showSessionInput, setShowSessionInput] = useState<boolean>(true);
  const [participants, setParticipants] = useState<number>(0); // 可后续扩展
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: DEFAULT_CANVAS_HEIGHT });

  // Toast 通知
  const [toast, setToast] = useState<string>('');
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
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

  // 跟踪当前路径状态，用于连续线条绘制
  const currentPathRef = useRef<{ [key: string]: { color: string; size: number } | null }>({});
  const lastDrawPointRef = useRef<{ [key: string]: { x: number; y: number; time?: number } | null }>({});

  // 画单个事件
  const drawEventOnCanvas = useCallback((event: DrawEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || event.type !== 'draw') return;
    
    // 确保坐标值存在
    if (event.prev_x === undefined || event.prev_y === undefined || 
        event.curr_x === undefined || event.curr_y === undefined) {
      return;
    }
    
    // 为每个客户端维护独立的状态
    const clientId = event.client_id || 'unknown';
    
    // 如果这个客户端还没有状态，初始化
    if (!lastDrawPointRef.current[clientId]) {
      lastDrawPointRef.current[clientId] = null;
    }
    if (!currentPathRef.current[clientId]) {
      currentPathRef.current[clientId] = null;
    }
    
    // 检查是否需要开始新路径（颜色/大小改变或非连续绘制）
    const isSameStyle = currentPathRef.current[clientId] && 
      currentPathRef.current[clientId]!.color === (event.color || '#222222') && 
      currentPathRef.current[clientId]!.size === (event.size || 2);
    
    const isContinuous = lastDrawPointRef.current[clientId] && 
      lastDrawPointRef.current[clientId]!.x === event.prev_x && 
      lastDrawPointRef.current[clientId]!.y === event.prev_y;
    
    // 检查时间间隔，只有在时间间隔很短的情况下才强制连接
    const timeGap = event.time && lastDrawPointRef.current[clientId]?.time ? 
      event.time - lastDrawPointRef.current[clientId].time : 0;
    const isRecentEvent = timeGap < 100; // 100ms 内的认为是连续事件
    
    // 如果后端发送的 prev 坐标与 lastPoint 不匹配，但 lastPoint 存在且样式相同，
    // 且时间间隔很短，我们就直接画一条从 lastPoint 到 curr 的线
    if (!isContinuous && lastDrawPointRef.current[clientId] && 
        currentPathRef.current[clientId] && isSameStyle && isRecentEvent) {
      // 直接画一条连接线
      ctx.beginPath();
      ctx.strokeStyle = event.color || '#222222';
      ctx.lineWidth = event.size || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastDrawPointRef.current[clientId]!.x, lastDrawPointRef.current[clientId]!.y);
      ctx.lineTo(event.curr_x, event.curr_y);
      ctx.stroke();
      
      // 更新最后绘制点
      lastDrawPointRef.current[clientId] = { x: event.curr_x, y: event.curr_y, time: event.time };
      return;
    }
    
    const shouldStartNewPath = !isSameStyle || !isContinuous;
    
    if (shouldStartNewPath) {
      // 结束当前路径
      if (currentPathRef.current[clientId]) {
        ctx.stroke();
      }
      
      // 开始新路径
      ctx.beginPath();
      ctx.strokeStyle = event.color || '#222222';
      ctx.lineWidth = event.size || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // 移动到起始点
      ctx.moveTo(event.prev_x, event.prev_y);
      
      // 更新当前路径状态
      currentPathRef.current[clientId] = {
        color: event.color || '#222222',
        size: event.size || 2
      };
    }
    
    // 画线到当前点
    ctx.lineTo(event.curr_x, event.curr_y);
    
    // 更新最后绘制点
    lastDrawPointRef.current[clientId] = { x: event.curr_x, y: event.curr_y, time: event.time };
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
    
    // 使用 useCallback 包装消息处理函数，避免依赖问题
    const handleMessage = (msg: ClientDrawResponse) => {
      if (msg.draw_event) {
        drawEventOnCanvas(msg.draw_event);
      } else if (msg.initial_history) {
        setHistory(msg.initial_history.events);
        setParticipants(msg.initial_history.events.length);
        // 重绘历史
        msg.initial_history.events.forEach(drawEventOnCanvas);
      }
    };
    
    c.onMessage(handleMessage);
    c.onOpen(() => {
      setStatus('connected');
      showToast('连接成功');
    });
    c.onClose(() => {
      setStatus('disconnected');
      showToast('连接断开');
    });
    c.connect();
    
    return () => {
      c.close();
    };
  }, [serverUrl, sessionId, drawEventOnCanvas]);

  // 组件卸载时清理
  useEffect(() => {
    // 保存 canvas 引用
    const canvas = canvasRef.current;
    
    return () => {
      // 结束所有客户端的路径
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          Object.keys(currentPathRef.current).forEach(clientId => {
            if (currentPathRef.current[clientId]) {
              ctx.stroke();
            }
          });
        }
      }
      // 清理状态
      currentPathRef.current = {};
      lastDrawPointRef.current = {};
    };
  }, []);

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
    const pos = getCanvasCoordinates(e);
    setIsDrawing(true);
    lastPos.current = pos;
    
    // 创建绘制事件
    const drawEvent = {
      type: 'draw' as const,
      color,
      size,
      prev_x: pos.x,
      prev_y: pos.y,
      curr_x: pos.x,
      curr_y: pos.y,
      client_id: client?.clientId || undefined, // 使用 undefined 而不是 null
      time: Date.now(),
    };
    
    // 本地绘制，立即反馈
    drawEventOnCanvas(drawEvent);
    
    // 发送 draw_event
    client?.send({
      draw_event: drawEvent,
    });
    
    if ('preventDefault' in e) e.preventDefault();
  };

  // 处理鼠标/触摸移动事件
  const handlePointerMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPos.current) return;
    
    const currentPos = getCanvasCoordinates(e);
    
    // 创建绘制事件
    const drawEvent = {
      type: 'draw' as const,
      color,
      size,
      prev_x: lastPos.current.x,
      prev_y: lastPos.current.y,
      curr_x: currentPos.x,
      curr_y: currentPos.y,
      client_id: client?.clientId || undefined, // 使用 undefined 而不是 null
      time: Date.now(),
    };
    
    // 本地绘制，立即反馈
    drawEventOnCanvas(drawEvent);
    
    // 发送 draw_event
    client?.send({
      draw_event: drawEvent,
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
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 结束所有客户端的路径
          Object.keys(currentPathRef.current).forEach(clientId => {
            if (currentPathRef.current[clientId]) {
              ctx.stroke();
            }
          });
          ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
        }
      }
      // 重置所有客户端的连续绘制状态
      currentPathRef.current = {};
      lastDrawPointRef.current = {};
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
