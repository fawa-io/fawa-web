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
      let firstChunk: Uint8Array | undefined;

      // --- Metadata Reading Loop ---
      // We need to read from the stream until we have the filename and size.
      while (!fileName || !fileSize) {
        const response = await reader.next();
        if (response.done) {
          // If the stream ends before we get metadata, something is wrong.
          if (!fileName) throw new Error("Stream ended before filename was received.");
          if (!fileSize && !firstChunk) throw new Error("Stream ended before file size or any data was received.");
          break; // Exit if stream is done (e.g., for zero-byte files).
        }

        const message = response.value;
        if (message.filename && !fileName) {
          fileName = message.filename;
          addLog(`Receiving file: ${fileName}`);
        }

        if (message.payload.case === "fileSize") {
          fileSize = Number(message.payload.value);
          addLog(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
        } else if (message.payload.case === "chunkData") {
          // This is the first chunk of data. Store it for later.
          if (!firstChunk) {
            firstChunk = message.payload.value;
            // If we don't have a file size yet, we can use the chunk length as a temporary value
            if (!fileSize) {
              addLog("File size not yet received, using first chunk size for initial progress.");
            }
          }
        }
        // If we have everything we need, break the loop
        if (fileName && (fileSize || firstChunk)) break;
      }

      if (!fileName) {
        throw new Error("Filename was not received from the server.");
      }
      if (!fileSize && firstChunk) {
        fileSize = firstChunk.length;
        addLog(`Warning: Total file size not provided by server. Assuming size of first chunk for single-chunk file.`);
      }

      // --- File Writing ---
      const fileStream = streamSaver.createWriteStream(fileName, { size: fileSize });
      const writer = fileStream.getWriter();
      let receivedBytes = 0;

      // Write the first chunk if we have it
      if (firstChunk) {
        await writer.write(firstChunk);
        receivedBytes += firstChunk.length;
        const progress = fileSize > 0 ? Math.round((receivedBytes / fileSize) * 100) : 0;
        setDownloadProgress(progress);
        addLog(`Wrote first chunk, progress: ${progress}%`);
      }

      // Process the rest of the stream
      for await (const response of { [Symbol.asyncIterator]: () => reader }) {
        if (response.payload.case === "chunkData") {
          await writer.write(response.payload.value);
          receivedBytes += response.payload.value.length;
          const progress =
            fileSize > 0 ? Math.round((receivedBytes / fileSize) * 100) : 0;
          setDownloadProgress(progress);
          addLog(`Received chunk, progress: ${progress}%`);
        }
      }

      await writer.close();
      addLog(`File ${fileName} saved successfully.`);

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
