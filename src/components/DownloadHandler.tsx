import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useFileService } from '../services/file/hooks/useFileService';

const DownloadHandler: React.FC = () => {
  const location = useLocation();
  const { downloadFile, logs, downloadProgress } = useFileService();
  const [message, setMessage] = useState('正在准备下载...');
  const hasDownloaded = useRef(false); // 使用 useRef 跟踪是否已触发下载

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const key = queryParams.get('key');

    if (key && !hasDownloaded.current) {
      setMessage(`正在下载文件，密钥为: ${key}`);
      downloadFile(key);
      hasDownloaded.current = true; // 标记已触发下载
    } else if (!key) {
      setMessage('未找到下载密钥。');
    }
  }, [location.search, downloadFile]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>文件下载</h1>
      <p>{message}</p>
      {downloadProgress > 0 && (
        <div style={{ width: '100%', backgroundColor: '#f3f3f3', borderRadius: '5px', margin: '10px 0' }}>
          <div
            style={{
              width: `${downloadProgress}%`,
              height: '20px',
              backgroundColor: '#4CAF50',
              textAlign: 'center',
              color: 'white',
              borderRadius: '5px',
            }}
          >
            {downloadProgress}%
          </div>
        </div>
      )}
      <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '10px', maxHeight: '300px', overflowY: 'auto', textAlign: 'left' }}>
        <h3>下载日志:</h3>
        {logs.map((log, index) => (
          <p key={index} style={{ margin: '0', fontSize: '0.9em' }}>{log}</p>
        ))}
      </div>
    </div>
  );
};

export default DownloadHandler;
