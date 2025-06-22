import { useState, useRef } from 'react';
import { useFileService } from '../hooks/useFileService';
import './FileService.css';

export function FileConsole() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [downloadFileName, setDownloadFileName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        logs,
        clearLogs,
        uploadFile,
        downloadFile,
        uploadProgress,
        downloadProgress,
    } = useFileService();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (selectedFile) {
            uploadFile(selectedFile);
        } else {
            alert('Please select a file to upload.');
        }
    };

    const handleDownload = () => {
        if (downloadFileName) {
            downloadFile(downloadFileName);
        } else {
            alert('Please enter a filename to download.');
        }
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            setSelectedFile(event.dataTransfer.files[0]);
            if (fileInputRef.current) {
                fileInputRef.current.files = event.dataTransfer.files;
            }
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <div className="page-container">
            <div className="fawa-logo">FAWA</div>
            <div className="file-console-container">
                <h1>超快的rpc流式传输文件服务，颠覆性的改变！</h1>

                <div className="card-row">
                    <div
                        className="card upload-card"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        <h2>Upload File</h2>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            ref={fileInputRef}
                            className="file-input"
                        />
                        {selectedFile && <p>Selected: {selectedFile.name}</p>}
                        <button onClick={handleUpload} disabled={!selectedFile}>Upload</button>
                        {uploadProgress > 0 && (
                            <div className="progress-bar-container">
                                <div className="progress-bar" style={{ width: `${uploadProgress}%` }}>
                                    {uploadProgress}%
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card download-card">
                        <h2>Download File</h2>
                        <input
                            type="text"
                            value={downloadFileName}
                            onChange={(e) => setDownloadFileName(e.target.value)}
                            placeholder="Enter filename to download"
                        />
                        <button onClick={handleDownload} disabled={!downloadFileName}>Download</button>
                        {downloadProgress > 0 && (
                            <div className="progress-bar-container">
                                <div className="progress-bar" style={{ width: `${downloadProgress}%` }}>
                                    {downloadProgress}%
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card logs-card">
                    <div className="logs-header">
                        <h3>Logs</h3>
                        <button onClick={clearLogs}>Clear</button>
                    </div>
                    <pre className="logs">
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </pre>
                </div>
            </div>
        </div>
    );
} 