import { useState } from "react";
import { create } from "@bufbuild/protobuf";

import { fileClient } from "../api";
import { SendFileRequestSchema, FileInfoSchema } from "../../../gen/file/v1/file_pb";

export function useFileService() {
  const [logs, setLogs] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [uploadedRandomKey, setUploadedRandomKey] = useState('');

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  const clearLogs = () => {
    setLogs([]);
    setUploadProgress(0);
    setDownloadProgress(0);
    setUploadedRandomKey('');
  };

  const uploadFile = async (file: File) => {
    clearLogs();
    addLog("--- Client-Streaming RPC (Upload) ---");
    addLog(
      `Preparing to upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
    );

    async function* sendRequests() {
      addLog(`Sending file info: ${file.name} (${file.size} bytes)`);
      yield create(SendFileRequestSchema, {
        payload: { case: "info", value: create(FileInfoSchema, { name: file.name, size: BigInt(file.size) }) },
      });

      let bytesSent = 0;
      const reader = file.stream().getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        yield create(SendFileRequestSchema, {
          payload: { case: "chunkData", value },
        });
        bytesSent += value.length;
        const progress = Math.round((bytesSent / file.size) * 100);
        setUploadProgress(progress);
        addLog(`Sent chunk, progress: ${progress}%`);
      }
    }

    try {
      const response = await fileClient.sendFile(sendRequests());
      addLog(`Upload complete: ${response.message}`);
      setUploadedRandomKey(response.randomkey);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      addLog(`Upload failed: ${message}`);
    }
    addLog("--- Finished ---");
  };

  const downloadFile = async (randomKey: string) => {
    clearLogs();
    addLog("--- Requesting Download URL ---");
    addLog(`Requesting download URL for key: ${randomKey}`);

    try {
      const response = await fileClient.getDownloadURL({ randomkey: randomKey });
      if (response.url) {
        addLog(`Download URL received: ${response.url}`);
        addLog(`Initiating download for file: ${response.filename}`);

        // Create a temporary link and click it to initiate download
        const a = document.createElement('a');
        a.href = response.url;
        a.download = response.filename || 'download'; // Suggest filename
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        addLog(`Download of "${response.filename}" initiated.`);
        setDownloadProgress(100); // Assuming direct download means instant "completion" from frontend perspective
      } else {
        addLog('Error: Could not get download URL.');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      addLog(`Download failed: ${message}`);
    }
    addLog("--- Finished ---");
  };

  return {
    logs,
    clearLogs,
    uploadFile,
    downloadFile,
    uploadProgress,
    downloadProgress,
    uploadedRandomKey,
  };
}
