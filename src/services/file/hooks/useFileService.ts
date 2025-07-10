import { useState } from "react";
import { create } from "@bufbuild/protobuf";
import streamSaver from "streamsaver";
import { fileClient } from "../api";
import { SendFileRequestSchema } from "../../../gen/fawa/file/v1/file_pb.ts";

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
      setUploadedRandomKey(response.randomkey);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      addLog(`Upload failed: ${message}`);
    }
    addLog("--- Finished ---");
  };

  const downloadFile = async (randomKey: string) => {
    clearLogs();
    addLog("--- Server-Streaming RPC (Download) ---");
    addLog(`Requesting file with random key: ${randomKey}`);

    try {
      const stream = fileClient.receiveFile({ randomkey: randomKey });
      const reader = stream[Symbol.asyncIterator]();

      let fileName = "";
      let fileSize = 0;
      const bufferedChunks: Uint8Array[] = []; // Buffer for chunks received before metadata

      let fileStream: WritableStream | undefined;
      let writer: WritableStreamDefaultWriter | undefined;
      let receivedBytes = 0;

      for await (const message of { [Symbol.asyncIterator]: () => reader }) {
        if (message.filename && !fileName) {
          fileName = message.filename;
          addLog(`Receiving file: ${fileName}`);
        }

        if (message.payload.case === "fileSize") {
          fileSize = Number(message.payload.value);
          addLog(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
        }

        if (message.payload.case === "chunkData") {
          if (!fileName) {
            // If filename is not yet known, buffer the chunk
            bufferedChunks.push(message.payload.value);
            addLog(`Buffered chunk (filename not yet received). Buffer size: ${bufferedChunks.length}`);
          } else {
            // If filename is known, and writer is not yet initialized, initialize it
            if (!fileStream) {
              // If fileSize is still 0, it means it wasn't sent or is a zero-byte file.
              // We can use the sum of buffered chunks + current chunk for initial size estimation.
              const initialSize = bufferedChunks.reduce((acc, chunk) => acc + chunk.length, 0) + message.payload.value.length;
              if (fileSize === 0) {
                addLog(`Warning: Total file size not provided by server. Estimating size based on initial chunks.`);
                fileSize = initialSize; // Use estimated size for progress calculation
              }
              fileStream = streamSaver.createWriteStream(fileName, { size: fileSize });
              writer = fileStream.getWriter();

              // Write all buffered chunks first
              for (const chunk of bufferedChunks) {
                await writer.write(chunk);
                receivedBytes += chunk.length;
                const progress = fileSize > 0 ? Math.round((receivedBytes / fileSize) * 100) : 0;
                setDownloadProgress(progress);
                addLog(`Wrote buffered chunk, progress: ${progress}%`);
              }
              bufferedChunks.length = 0; // Clear the buffer
            }

            // Write the current chunk
            if (writer) {
              await writer.write(message.payload.value);
              receivedBytes += message.payload.value.length;
              const progress = fileSize > 0 ? Math.round((receivedBytes / fileSize) * 100) : 0;
              setDownloadProgress(progress);
              addLog(`Received chunk, progress: ${progress}%`);
            }
          }
        }
      }

      // After the loop, ensure filename was received and writer was closed
      if (!fileName) {
        throw new Error("Filename was not received from the server.");
      }
      if (writer) {
        await writer.close();
        addLog(`File ${fileName} saved successfully.`);
      } else {
        // This case might happen for zero-byte files where no chunkData is sent
        // or if only metadata was sent but no actual file data.
        // If bufferedChunks is not empty, it means we received chunks but no filename.
        if (bufferedChunks.length > 0) {
          throw new Error("Received data chunks but no filename to write them to.");
        }
        // If no chunks and no writer, it implies a zero-byte file or an empty stream.
        // We should still create and close the file to ensure it exists.
        if (fileName) {
          fileStream = streamSaver.createWriteStream(fileName, { size: 0 });
          writer = fileStream.getWriter();
          await writer.close();
          addLog(`Zero-byte file ${fileName} created successfully.`);
        }
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
