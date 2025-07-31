import { useState, useEffect, useRef, useCallback } from "react";
import { canvaClient } from "../api";
import { create } from "@bufbuild/protobuf";
import type { DrawEvent, ClientDrawRequest } from "../../../gen/canva/v1/canva_pb";
import { DrawEventSchema, ClientDrawRequestSchema } from "../../../gen/canva/v1/canva_pb";

interface DrawPosition {
  prevX: number;
  prevY: number;
  currX: number;
  currY: number;
}

export interface CanvasSettings {
  color: string;
  size: number;
}

export function useCanvaService() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [settings, setSettings] = useState<CanvasSettings>({
    color: "#000000",
    size: 2
  });
  const [clientId, setClientId] = useState<string>("");
  
  // 存储待发送的绘图事件
  const pendingEvents = useRef<ClientDrawRequest[]>([]);
  // 存储流的取消控制器
  const abortController = useRef<AbortController | null>(null);
  // 存储当前激活的流
  const activeStream = useRef<ReturnType<typeof canvaClient.collaborate> | null>(null);
  // 是否正在处理事件
  const isProcessing = useRef<boolean>(false);
  // 保存processPendingEvents函数引用，避免依赖循环问题
  const processPendingEventsRef = useRef<() => void>(() => {});
  
  // 画布相关引用
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  // 跟踪上一个绘制点，用于连续线条
  const lastDrawPointRef = useRef<{ x: number; y: number } | null>(null);
  // 跟踪当前路径状态
  const currentPathRef = useRef<{ color: string; size: number } | null>(null);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const initializeCanvas = useCallback((canvas: HTMLCanvasElement) => {
    if (!canvas) return;
    canvasRef.current = canvas;
    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    context.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    context.lineCap = "round";
    context.lineJoin = "round";
    contextRef.current = context;
    addLog("画布初始化完成");
  }, [addLog]);

  const drawOnCanvas = useCallback((event: DrawEvent, skipOwnEvents: boolean = true) => {
    if (!contextRef.current) return;
    
    // 如果是跳过自己的事件，且是当前用户的事件，则不绘制
    if (skipOwnEvents && clientId && event.clientId === clientId) {
      return;
    }
    
    const ctx = contextRef.current;
    
    switch(event.type) {
      case "draw": {
        // 检查是否需要开始新路径（颜色/大小改变或非连续绘制）
        const isSameStyle = currentPathRef.current && 
          currentPathRef.current.color === event.color && 
          currentPathRef.current.size === event.size;
        
        const isContinuous = lastDrawPointRef.current && 
          lastDrawPointRef.current.x === event.prevX && 
          lastDrawPointRef.current.y === event.prevY;
        
        const shouldStartNewPath = !isSameStyle || !isContinuous;
        
        if (shouldStartNewPath) {
          // 结束当前路径
          if (currentPathRef.current) {
            ctx.stroke();
          }
          
          // 开始新路径
          ctx.beginPath();
          ctx.strokeStyle = event.color;
          ctx.lineWidth = event.size;
          ctx.moveTo(event.prevX, event.prevY);
          
          // 更新当前路径状态
          currentPathRef.current = { color: event.color, size: event.size };
        }
        
        // 添加线段到当前路径
        ctx.lineTo(event.currX, event.currY);
        
        // 保存当前点作为下一个线段的起点
        lastDrawPointRef.current = { x: event.currX, y: event.currY };
        break;
      }
        
      case "clear": {
        if (canvasRef.current) {
          // 结束当前路径
          if (currentPathRef.current) {
            ctx.stroke();
          }
          
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          // 清除时重置连续绘制状态
          lastDrawPointRef.current = null;
          currentPathRef.current = null;
          addLog(`画布已被用户 ${event.clientId} 清除`);
        }
        break;
      }
        
      default:
        break;
    }
  }, [addLog, clientId]);

  // 处理待发送的事件
  const processPendingEvents = useCallback(async () => {
    if (isProcessing.current || !isConnected) return;
    
    isProcessing.current = true;
    
    try {
      // 使用类似 greet 的简单生成器
      async function* generateEvents() {
        for (const event of pendingEvents.current) {
          yield event;
          // 移除延迟，确保绘制事件连续
        }
      }
      
      // 清空待发送队列
      const currentEvents = [...pendingEvents.current];
      pendingEvents.current = [];
      
      if (currentEvents.length === 0) {
        isProcessing.current = false;
        return;
      }
      
      addLog(`处理 ${currentEvents.length} 个绘制事件`);
      
      // 创建一个新的流处理
      const stream = canvaClient.collaborate(generateEvents());
      
      // 处理响应
      for await (const response of stream) {
        if (response.message.case === "initialHistory") {
          const history = response.message.value;
          addLog(`收到初始历史记录，共 ${history.events.length} 个事件`);
          
          for (const event of history.events) {
            drawOnCanvas(event);
          }
        } else if (response.message.case === "drawEvent") {
          const drawEvent = response.message.value;
          drawOnCanvas(drawEvent);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message !== "AbortError") {
        addLog(`流处理错误: ${error.message}`);
      }
    } finally {
      isProcessing.current = false;
      
      // 检查是否有新的待处理事件
      if (pendingEvents.current.length > 0) {
        processPendingEventsRef.current();
      }
    }
  }, [addLog, drawOnCanvas, isConnected]);

  // 更新processPendingEventsRef引用
  useEffect(() => {
    processPendingEventsRef.current = processPendingEvents;
  }, [processPendingEvents]);

  // 排队等待发送的事件
  const queueEvent = useCallback((drawEvent: DrawEvent) => {
    if (!isConnected) return;
    
    const request = create(ClientDrawRequestSchema, {
      message: {
        case: "drawEvent",
        value: drawEvent
      }
    });
    
    pendingEvents.current.push(request);
    
    // 如果没有激活流程，启动流处理
    if (!isProcessing.current) {
      processPendingEventsRef.current();
    }
  }, [isConnected]);

  // 发送事件
  const sendEvent = useCallback((type: string, position: DrawPosition) => {
    // 创建绘制事件
    const drawEvent = create(DrawEventSchema, {
      type,
      color: settings.color,
      size: settings.size,
      prevX: Math.round(position.prevX),
      prevY: Math.round(position.prevY),
      currX: Math.round(position.currX),
      currY: Math.round(position.currY),
      clientId
    });
    
    // 本地立即绘制（不跳过自己的事件）
    drawOnCanvas(drawEvent, false);
    
    // 排队等待发送
    queueEvent(drawEvent);
  }, [settings, clientId, drawOnCanvas, queueEvent]);

  const startDrawing = useCallback((x: number, y: number) => {
    if (!contextRef.current || !isConnected) return;
    isDrawingRef.current = true;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const roundedX = Math.round(x - rect.left);
    const roundedY = Math.round(y - rect.top);
    lastPointRef.current = { x: roundedX, y: roundedY };
    
    // 不发送第一个绘制事件，因为还没有线段
    // 第一个线段将在 draw 函数中发送
  }, [isConnected]);

  const draw = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current || !contextRef.current || !isConnected) return;
    
    const canvas = canvasRef.current;
    if (!canvas || !lastPointRef.current) return;
    
    const rect = canvas.getBoundingClientRect();
    const currX = Math.round(x - rect.left);
    const currY = Math.round(y - rect.top);
    
    const position: DrawPosition = {
      prevX: lastPointRef.current.x,
      prevY: lastPointRef.current.y,
      currX: currX,
      currY: currY
    };
    
    lastPointRef.current = { x: currX, y: currY };
    
    sendEvent("draw", position);
  }, [isConnected, sendEvent]);

  const finishDrawing = useCallback(() => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    if (!isConnected) return;
    
    const position: DrawPosition = {
      prevX: 0,
      prevY: 0,
      currX: 0,
      currY: 0
    };
    
    sendEvent("clear", position);
    addLog("发送清除画布命令");
  }, [isConnected, sendEvent, addLog]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (!isConnected) {
      addLog("未连接到服务器");
      return;
    }
    
    try {
      // 确保当前路径被绘制
      if (contextRef.current && currentPathRef.current) {
        contextRef.current.stroke();
        currentPathRef.current = null;
      }
      
      if (abortController.current) {
        abortController.current.abort();
        abortController.current = null;
      }
      
      if (activeStream.current) {
        activeStream.current = null;
      }
      
      // 清空待处理队列
      pendingEvents.current = [];
      isProcessing.current = false;
      
      setIsConnected(false);
      setClientId("");
      addLog("已断开连接");
    } catch (error) {
      addLog(`断开连接出错: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [isConnected, addLog]);

  // 连接
  const connect = useCallback(async () => {
    if (isConnected) {
      addLog("已经连接到服务器，请勿重复连接");
      return;
    }
    
    clearLogs();
    addLog("正在连接到画布协作服务...");
    
    try {
      // 生成随机客户端ID
      const randomId = Math.random().toString(36).substring(2, 10);
      setClientId(randomId);
      
      // 创建一个空请求流，只用于接收初始历史
      async function* emptyRequest() {
        // 发送一个ping事件确认连接
        const pingEvent = create(DrawEventSchema, {
          type: "ping",
          color: "",
          size: 0,
          prevX: 0,
          prevY: 0,
          currX: 0,
          currY: 0,
          clientId: randomId
        });
        
        const request = create(ClientDrawRequestSchema, {
          message: {
            case: "drawEvent",
            value: pingEvent
          }
        });
        
        yield request;
      }
      
      // 创建一个控制器用于可能的中止
      const controller = new AbortController();
      abortController.current = controller;
      
      // 启动一个初始流接收历史数据
      const initStream = canvaClient.collaborate(emptyRequest());
      activeStream.current = initStream;
      
      setIsConnected(true);
      addLog("已连接到协作画布服务");
      
      // 处理初始流响应
      try {
        for await (const response of initStream) {
          if (response.message.case === "initialHistory") {
            const history = response.message.value;
            addLog(`收到初始历史记录，共 ${history.events.length} 个事件`);
            
            for (const event of history.events) {
              drawOnCanvas(event);
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message !== "AbortError") {
          addLog(`初始流错误: ${error.message}`);
          disconnect();
          return;
        }
      }
      
      // 设置一个周期性监听新事件的流
      const startListening = async () => {
        if (!isConnected) return;
        
        try {
          async function* listenerRequest() {
            const listenerEvent = create(DrawEventSchema, {
              type: "listen",
              color: "",
              size: 0,
              prevX: 0,
              prevY: 0,
              currX: 0,
              currY: 0,
              clientId: randomId
            });
            
            const request = create(ClientDrawRequestSchema, {
              message: {
                case: "drawEvent",
                value: listenerEvent
              }
            });
            
            yield request;
          }
          
          const listenerStream = canvaClient.collaborate(listenerRequest());
          
          for await (const response of listenerStream) {
            if (response.message.case === "drawEvent") {
              const drawEvent = response.message.value;
              drawOnCanvas(drawEvent);
            }
          }
        } catch (error) {
          if (error instanceof Error && error.message !== "AbortError" && isConnected) {
            addLog(`监听流错误: ${error.message}`);
            
            // 尝试重新连接监听流
            setTimeout(startListening, 1000);
          }
        }
      };
      
      // 启动监听流
      startListening();
      
    } catch (error) {
      addLog(`连接失败: ${error instanceof Error ? error.message : "未知错误"}`);
      setIsConnected(false);
    }
  }, [addLog, clearLogs, disconnect, drawOnCanvas, isConnected]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 确保当前路径被绘制
      if (contextRef.current && currentPathRef.current) {
        contextRef.current.stroke();
      }
      
      if (isConnected) {
        disconnect();
      }
    };
  }, [disconnect, isConnected]);

  return {
    logs,
    clearLogs,
    isConnected,
    settings,
    setSettings,
    canvasRef,
    initializeCanvas,
    startDrawing,
    draw,
    finishDrawing,
    connect,
    disconnect,
    clearCanvas
  };
}
