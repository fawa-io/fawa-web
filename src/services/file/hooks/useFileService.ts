import { useState } from "react";
import { create } from "@bufbuild/protobuf";
import { fileClient } from "../api";
import { SendFileRequestSchema } from "../../../gen/fawa/file/v1/file_pb.ts";

export function useFileService() {
  const [logs, setLogs] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadProgress, setDownloadProgress] = useState(0);

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
  };

  const uploadFile = async (file: File) => {
    clearLogs();
    addLog("--- Client-Streaming RPC (Upload) ---");
    addLog(
      `Preparing to upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
    );

    async function* sendRequests() {
      addLog(`Sending file name: ${file.name}`);
      yield create(SendFileRequestSchema, {
        payload: { case: "fileName", value: file.name },
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
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      addLog(`Upload failed: ${message}`);
    }
    addLog("--- Finished ---");
  };

  const downloadFile = async (fileName: string) => {
    clearLogs();
    addLog("--- Server-Streaming RPC (Download) ---");
    addLog(`Requesting file: ${fileName}`);

    try {
      const stream = fileClient.receiveFile({ fileName });
      let fileSize = 0;
      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];

      for await (const response of stream) {
        if (response.payload.case === "fileSize") {
          fileSize = Number(response.payload.value);
          addLog(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
        } else if (response.payload.case === "chunkData") {
          chunks.push(response.payload.value);
          receivedBytes += response.payload.value.length;
          const progress =
            fileSize > 0 ? Math.round((receivedBytes / fileSize) * 100) : 0;
          setDownloadProgress(progress);
          addLog(`Received chunk, progress: ${progress}%`);
        }
      }

      addLog("File download complete, assembling file...");
      const fileBlob = new Blob(chunks);
      const url = window.URL.createObjectURL(fileBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addLog(`File saved as ${fileName}`);
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
  };
}
