import { useState, useRef } from 'react';
import { useFileService } from '../hooks/useFileService';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode.react'; // Added import
import './FileService.css';

export function FileConsole() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [downloadRandomKey, setDownloadRandomKey] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        logs,
        clearLogs,
        uploadFile,
        downloadFile,
        uploadProgress,
        downloadProgress,
        uploadedRandomKey,
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
        if (downloadRandomKey) {
            downloadFile(downloadRandomKey);
        } else {
            alert('Please enter a random key to download.');
        }
    };

    const handleCopyToClipboard = () => {
        if (uploadedRandomKey) {
            navigator.clipboard.writeText(uploadedRandomKey).then(() => {
                alert('Random key copied to clipboard!');
            }, (err) => {
                alert('Failed to copy random key.');
                console.error('Could not copy text: ', err);
            });
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
        <div className="file-page-container">
            <Link to="/" className="file-fawa-logo">FAWA</Link>
            <div className="file-service-console-container">
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
                            className="file-input-hidden"
                            id="file-upload"
                        />
                        <label htmlFor="file-upload" className="custom-file-upload">
                            Choose File
                        </label>
                        {selectedFile ? (
                            <p>Selected file: {selectedFile.name}</p>
                        ) : (
                            <p>No file chosen</p>
                        )}
                        <button onClick={handleUpload} disabled={!selectedFile}>Upload</button>
                        {uploadedRandomKey && (
                            <div className="qr-code-container">
                                <p className="scan-to-download-text">Scan to download</p>
                                <QRCode value={`${window.location.origin}/download?key=${uploadedRandomKey}`} size={128} level="H" />
                                <p className="random-key-display">Random Key: <span className="highlight-random-key">{uploadedRandomKey}</span></p>
                                <button onClick={handleCopyToClipboard}>Copy Random Key</button>
                            </div>
                        )}
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
                            value={downloadRandomKey}
                            onChange={(e) => setDownloadRandomKey(e.target.value)}
                            placeholder="Enter random key to download"
                        />
                        <button onClick={handleDownload} disabled={!downloadRandomKey}>Download</button>
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