import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'fawa.marsevilspirit.com',
    ],
  },
  optimizeDeps: {
    include: [
      '@bufbuild/protobuf',
      '@connectrpc/connect',
      '@connectrpc/connect-web',
    ],
  },
  resolve: {
    alias: {
      './gen/proto': path.resolve(__dirname, 'src/gen/proto'),
    },
  },
})
