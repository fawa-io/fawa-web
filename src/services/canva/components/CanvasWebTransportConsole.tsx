import React from 'react';
import { CanvasWebTransport } from '../webtransport/CanvasWebTransport';

// 你可以根据实际部署情况修改 serverUrl
const SERVER_URL = 'https://localhost:8081';

export function CanvasWebTransportConsole() {
  return <CanvasWebTransport serverUrl={SERVER_URL} />;
} 