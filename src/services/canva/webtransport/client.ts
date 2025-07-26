 // WebTransport/WebSocket 客户端，自动优先 WebTransport，失败降级 WebSocket
// 用于与 Newcanva 后端进行 JSON 消息全双工通信

export type DrawEvent = {
    type: string;
    color?: string;
    size?: number;
    prev_x?: number;
    prev_y?: number;
    curr_x?: number;
    curr_y?: number;
    client_id?: string;
    time?: number;
  };
  
  
  export type History = {
    events: DrawEvent[];
  };
  
  export type ClientDrawRequest = {
    draw_event?: DrawEvent;
  };
  
  export type ClientDrawResponse = {
    draw_event?: DrawEvent;
    initial_history?: History;
  };
  
  type MessageHandler = (msg: ClientDrawResponse) => void;
  type OpenHandler = () => void;
  type CloseHandler = (ev?: CloseEvent | Event) => void;
  
  type TransportType = 'webtransport' | 'websocket';
  
  export class CanvaRealtimeClient {
    private url: string;
    private wsUrl: string;
    private transport: TransportType | null = null;
    private wtSession: WebTransport | null = null;
    private ws: WebSocket | null = null;
    private onMessageHandler: MessageHandler | null = null;
    private onOpenHandler: OpenHandler | null = null;
    private onCloseHandler: CloseHandler | null = null;
  
    constructor(wtUrl: string, wsUrl?: string) {
      this.url = wtUrl;
      this.wsUrl = wsUrl || wtUrl.replace('/webtransport/canva', '/ws/canva').replace(/^http/, 'ws');
    }
  
    async connect() {
      // 优先尝试 WebTransport，失败时降级到 WebSocket
      if ('WebTransport' in window) {
        try {
          console.log('尝试连接 WebTransport:', this.url);
          this.wtSession = new window.WebTransport(this.url, {
            // 可加认证等参数
          });
          await this.wtSession.ready;
          console.log('WebTransport 连接成功');
          this.transport = 'webtransport';
          this.handleWebTransport();
          if (this.onOpenHandler) this.onOpenHandler();
          return;
        } catch (error) {
          console.error('WebTransport 连接失败，降级到 WebSocket:', error);
          // 降级到 WebSocket
          this.connectWebSocket();
        }
      } else {
        console.log('浏览器不支持 WebTransport，使用 WebSocket');
        this.connectWebSocket();
      }
    }

    private connectWebSocket() {
      try {
        console.log('尝试连接 WebSocket:', this.wsUrl);
        this.ws = new WebSocket(this.wsUrl);
        this.ws.onopen = () => {
          console.log('WebSocket 连接成功');
          this.transport = 'websocket';
          if (this.onOpenHandler) this.onOpenHandler();
        };
        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            console.log('WebSocket 收到消息:', msg);
            if (this.onMessageHandler) this.onMessageHandler(msg);
          } catch (error) {
            console.error('WebSocket 消息解析失败:', error);
          }
        };
        this.ws.onclose = (event) => {
          console.log('WebSocket 连接关闭:', event);
          if (this.onCloseHandler) this.onCloseHandler(event);
        };
        this.ws.onerror = (error) => {
          console.error('WebSocket 连接错误:', error);
        };
      } catch (error) {
        console.error('WebSocket 连接失败:', error);
        throw error;
      }
    }
  
    private async handleWebTransport() {
      // 处理 bidirectional streams
      if (!this.wtSession) return;
      console.log('开始处理 WebTransport streams');
      
      // 同时处理 bidirectional 和 unidirectional streams
      const [bidirectionalReader, unidirectionalReader] = await Promise.all([
        this.wtSession.incomingBidirectionalStreams.getReader(),
        this.wtSession.incomingUnidirectionalStreams.getReader()
      ]);

      console.log('获取到 stream readers');

      // 处理 bidirectional streams
      this.handleStreamReader(bidirectionalReader, true);
      // 处理 unidirectional streams (历史数据通常在这里)
      this.handleStreamReader(unidirectionalReader, false);
    }

    private async handleStreamReader(reader: ReadableStreamDefaultReader<WebTransportBidirectionalStream | ReadableStream>, isBidirectional: boolean) {
      console.log(`开始处理 ${isBidirectional ? 'bidirectional' : 'unidirectional'} streams`);
      while (true) {
        try {
          const { value: stream, done } = await reader.read();
          if (done) {
            console.log(`${isBidirectional ? 'bidirectional' : 'unidirectional'} stream reader 结束`);
            break;
          }
          
          console.log(`收到 ${isBidirectional ? 'bidirectional' : 'unidirectional'} stream`);
          
          if (isBidirectional) {
            this.handleBidirectionalStream(stream as WebTransportBidirectionalStream);
          } else {
            this.handleUnidirectionalStream(stream as ReadableStream);
          }
        } catch (error) {
          console.error('Error reading stream:', error);
          break;
        }
      }
    }

    private async handleBidirectionalStream(stream: WebTransportBidirectionalStream) {
      console.log('处理 bidirectional stream');
      const decoder = new TextDecoder();
      const reader = stream.readable.getReader();
      let buffer = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log('bidirectional stream 读取完成');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        console.log('bidirectional stream 收到数据块，当前 buffer:', buffer);
        
        // 尝试解析完整的 JSON 消息
        try {
          const msg = JSON.parse(buffer);
          console.log('bidirectional stream 解析到消息:', msg);
          if (this.onMessageHandler) this.onMessageHandler(msg);
          buffer = ''; // 清空缓冲区
        } catch {
          // JSON 不完整，继续读取
          console.log('bidirectional stream JSON 不完整，继续读取');
        }
      }
    }

    private async handleUnidirectionalStream(stream: ReadableStream) {
      console.log('处理 unidirectional stream');
      const decoder = new TextDecoder();
      const reader = stream.getReader();
      let buffer = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log('unidirectional stream 读取完成');
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        console.log('unidirectional stream 收到数据块，当前 buffer:', buffer);
        
        // 尝试解析完整的 JSON 消息
        try {
          const msg = JSON.parse(buffer);
          console.log('unidirectional stream 解析到消息:', msg);
          if (this.onMessageHandler) this.onMessageHandler(msg);
          buffer = ''; // 清空缓冲区
        } catch {
          // JSON 不完整，继续读取
          console.log('unidirectional stream JSON 不完整，继续读取');
        }
      }
    }
  
    send(msg: ClientDrawRequest) {
      const data = JSON.stringify(msg);
      if (this.transport === 'websocket' && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(data);
      } else if (this.transport === 'webtransport' && this.wtSession) {
        // 发送到所有 bidirectional stream
        // 这里只做简单实现，实际可维护一个写入流
        this.wtSession.createBidirectionalStream().then((stream: WebTransportBidirectionalStream) => {
          const writer = stream.writable.getWriter();
          writer.write(new TextEncoder().encode(data));
          writer.close();
        });
      }
    }
  
    onMessage(handler: MessageHandler) {
      this.onMessageHandler = handler;
    }
    onOpen(handler: OpenHandler) {
      this.onOpenHandler = handler;
    }
    onClose(handler: CloseHandler) {
      this.onCloseHandler = handler;
    }
  
    close() {
      if (this.transport === 'websocket' && this.ws) {
        this.ws.close();
      } else if (this.transport === 'webtransport' && this.wtSession) {
        this.wtSession.close();
      }
    }
  }
  