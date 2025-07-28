import { CanvasWebTransport } from '../webtransport/CanvasWebTransport';

const SERVER_URL = import.meta.env.VITE_CANVA_SERVICE_WEBTRANSPORT_URL || '/';

export function CanvasWebTransportConsole() {
  return <CanvasWebTransport serverUrl={SERVER_URL} />;
} 