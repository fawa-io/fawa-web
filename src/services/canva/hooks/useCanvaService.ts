/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useCallback, useEffect } from "react";
import { create } from "@bufbuild/protobuf";

import { canvaClient } from "../api";
import type {
  ClientDrawRequest,
  DrawEvent,
} from "../../../gen/fawa/canva/v1/canva_pb";
import {
  // ClientDrawRequestSchema, // 未使用，暂时注释掉
  DrawEventSchema,
} from "../../../gen/fawa/canva/v1/canva_pb";

export interface DrawSettings {
  color: string;
  size: number;
}

export function useCanvaService() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [clientId, setClientId] = useState<string>("");
  const [drawHistory, setDrawHistory] = useState<DrawEvent[]>([]);
  const [drawSettings, setDrawSettings] = useState<DrawSettings>({
    color: "#000000",
    size: 5,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  
  // 消息队列，用于存储要发送的消息
  const messageQueueRef = useRef<Array<DrawEvent>>([]);
  // 流控制器
  const streamControllerRef = useRef<{
    enqueue: (event: DrawEvent) => void;
    close: () => void;
  } | null>(null);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);
  
  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (streamControllerRef.current) {
      try {
        streamControllerRef.current.close();
      } catch {
        // 忽略错误
      }
      streamControllerRef.current = null;
    }
    
    // 清空消息队列
    messageQueueRef.current = [];
    
    setIsConnected(false);
    setClientId("");
    addLog("已断开连接");
  }, [addLog]);

  const connect = useCallback(async () => {
    if (isConnected) {
      disconnect();
    }

    clearLogs();
    addLog("--- 开始双向流式连接 ---");
    addLog("正在连接到协同画布服务...");

    try {
      // 创建新的AbortController
      abortControllerRef.current = new AbortController();
      
      // 创建消息队列
      messageQueueRef.current = [];
      
      // 添加初始ping消息
      const pingEvent = create(DrawEventSchema, {
        type: "ping",
        color: "#000000",
        size: 1,
        prevX: 0,
        prevY: 0,
        currX: 0,
        currY: 0,
        clientId: "",
      });
      
      messageQueueRef.current.push(pingEvent);
      
      // 创建请求生成器，从队列获取消息
      const { readable, writable } = new TransformStream();
      const reader = readable.getReader();
      const writer = writable.getWriter();
      
      // 设置流控制器
      streamControllerRef.current = {
        enqueue: (event: DrawEvent) => {
          messageQueueRef.current.push(event);
          processQueue();
        },
        close: () => {
          try {
            writer.close();
            reader.cancel();
          } catch {
            // 忽略错误
          }
        }
      };
      
      // 处理队列
      const processQueue = async () => {
        if (messageQueueRef.current.length > 0 && streamControllerRef.current) {
          const event = messageQueueRef.current.shift();
          if (!event) return;
          
          try {
            await writer.write({
              message: {
                case: "drawEvent",
                value: event
              }
            } as ClientDrawRequest);
            addLog(`发送了${event.type === "ping" ? "ping" : event.type === "clear" ? "清除" : "绘制"}事件`);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            addLog(`发送事件失败: ${errorMsg}`);
            // 只有当错误不表明流已关闭时才放回队列重试
            if (!errorMsg.includes('closed')) {
              messageQueueRef.current.unshift(event);
            }
          }
        }
      };
      
      // 立即处理队列
      processQueue();
      
      // 创建请求生成器
      async function* requestGenerator(): AsyncGenerator<ClientDrawRequest, void, unknown> {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value as ClientDrawRequest;
        }
      }

      // 创建双向流
      const stream = canvaClient.collaborate(requestGenerator());
      setIsConnected(true);
      addLog("已连接到协同画布");
      
      // 设置定期ping
      pingIntervalRef.current = window.setInterval(() => {
        if (streamControllerRef.current) {
          streamControllerRef.current.enqueue(create(DrawEventSchema, {
            type: "ping",
            color: "#000000",
            size: 1,
            prevX: 0,
            prevY: 0,
            currX: 0,
            currY: 0,
            clientId: "",
          }));
        }
      }, 30000);
      
      // 处理响应
      (async () => {
        try {
          for await (const response of stream) {
            if (response.message.case === "drawEvent") {
              const event = response.message.value;
              
              // 忽略ping类型的事件
              if (event.type === "ping") continue;
              
              addLog(`收到绘制事件: 类型=${event.type}, 客户端=${event.clientId}`);
              
              // 如果有客户端ID，使用函数式更新检查并更新
              if (event.clientId) {
                setClientId((currentId) => {
                  if (currentId === "") {
                    addLog(`分配的客户端ID: ${event.clientId}`);
                    return event.clientId;
                  }
                  return currentId;
                });
              }
              
              // 特殊处理clear类型事件
              if (event.type === "clear") {
                clearCanvasContent();
                addLog(`收到来自客户端${event.clientId}的清除画布命令`);
              } else {
                // 处理绘制事件
                handleDrawEvent(event);
              }
              
            } else if (response.message.case === "initialHistory") {
              const history = response.message.value;
              addLog(`收到历史记录: ${history.events.length} 个事件`);
              
              // 处理历史记录
              setDrawHistory(history.events);
              renderHistory(history.events);
            }
          }
          addLog("服务器流已关闭");
          disconnect();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "未知错误";
          addLog(`流错误: ${errorMsg}`);
          disconnect();
        }
      })();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "未知错误";
      addLog(`连接失败: ${errorMsg}`);
      disconnect();
    }
  }, [disconnect, clientId, addLog, clearLogs]);

  // 清除画布内容
  const clearCanvasContent = useCallback(() => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [canvasRef]);

  // 发送绘制事件到服务器
  const sendDrawEvent = useCallback(
    (event: DrawEvent) => {
      if (!streamControllerRef.current || !isConnected) {
        addLog("未连接到服务器，无法发送绘制事件");
        return;
      }

      try {
        streamControllerRef.current.enqueue(event);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "未知错误";
        addLog(`发送绘制事件失败: ${errorMsg}`);
      }
    },
    [isConnected, addLog]
  );

  // 处理绘制事件
  const handleDrawEvent = useCallback(
    (event: DrawEvent) => {
      if (!canvasRef.current) return;
      
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      
      ctx.strokeStyle = event.color;
      ctx.lineWidth = event.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      // 绘制线条
      ctx.beginPath();
      ctx.moveTo(event.prevX, event.prevY);
      ctx.lineTo(event.currX, event.currY);
      ctx.stroke();
    },
    [canvasRef]
  );

  // 绘制历史记录
  const renderHistory = useCallback((events: DrawEvent[]) => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    // 清除画布
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // 重新绘制所有历史事件
    for (const event of events) {
      // 跳过ping类型事件和clear事件
      if (event.type === "ping") continue;
      
      // 如果是clear事件，则清除画布并重新开始绘制
      if (event.type === "clear") {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        continue;
      }
      
      // 正常绘制其他事件
      handleDrawEvent(event);
    }
  }, [handleDrawEvent, canvasRef]);

  // 生成绘制事件
  const createDrawEvent = useCallback(
    (type: string, prevX: number, prevY: number, currX: number, currY: number): DrawEvent => {
      return create(DrawEventSchema, {
        type,
        color: drawSettings.color,
        size: drawSettings.size,
        prevX,
        prevY,
        currX,
        currY,
        clientId: "",  // 服务器会设置此字段
      });
    },
    [drawSettings]
  );

  // 清除资源
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      
      if (streamControllerRef.current) {
        streamControllerRef.current.close();
      }
    };
  }, []);

  return {
    logs,
    clearLogs,
    connect,
    disconnect,
    isConnected,
    clientId,
    drawHistory,
    canvasRef,
    drawSettings,
    setDrawSettings,
    sendDrawEvent,
    createDrawEvent,
    renderHistory, // 导出renderHistory函数
  };
} 