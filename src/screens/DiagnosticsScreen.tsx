// src/screens/DiagnosticsScreen.tsx
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Camera,
  Wifi,
  Printer,
  HardDrive,
  CreditCard,
  FolderOpen,
  X,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DiagnosticResult {
  name: string;
  status: 'checking' | 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

interface DiagnosticsScreenProps {
  onClose: () => void;
}

export function DiagnosticsScreen({ onClose }: DiagnosticsScreenProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [cameraPreview, setCameraPreview] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    runDiagnostics();
    return () => {
      // Cleanup camera preview
      if (cameraPreview) {
        cameraPreview.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && cameraPreview) {
      videoRef.current.srcObject = cameraPreview;
    }
  }, [cameraPreview]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setDiagnostics([]);

    const checks: DiagnosticResult[] = [
      { name: 'Webcam', status: 'checking', message: 'Checking webcam...' },
      { name: 'Internet Connection', status: 'checking', message: 'Checking internet...' },
      { name: 'Printer', status: 'checking', message: 'Checking printer...' },
      { name: 'Card Reader', status: 'checking', message: 'Checking card reader...' },
      { name: 'Temp Directory', status: 'checking', message: 'Checking temp directory...' },
      { name: 'Python Bridge', status: 'checking', message: 'Checking Python...' },
      { name: 'FFmpeg', status: 'checking', message: 'Checking FFmpeg...' },
      { name: 'Frame Templates', status: 'checking', message: 'Checking frame templates...' },
    ];

    setDiagnostics([...checks]);

    // Check Webcam
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      if (videoDevices.length === 0) {
        checks[0] = { name: 'Webcam', status: 'fail', message: 'No webcam found', details: '0 cameras detected' };
      } else {
        // Try to get camera stream for preview
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } }
        });
        setCameraPreview(stream);

        checks[0] = {
          name: 'Webcam',
          status: 'pass',
          message: `${videoDevices.length} camera(s) found`,
          details: videoDevices.map(d => d.label || 'Unknown Camera').join(', ')
        };
      }
    } catch (error) {
      checks[0] = { name: 'Webcam', status: 'fail', message: 'Camera access denied', details: String(error) };
    }
    setDiagnostics([...checks]);

    // Check Internet Connection
    try {
      const response = await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-cache' });
      checks[1] = { name: 'Internet Connection', status: 'pass', message: 'Connected', details: 'Google reachable' };
    } catch (error) {
      checks[1] = { name: 'Internet Connection', status: 'fail', message: 'No internet connection', details: String(error) };
    }
    setDiagnostics([...checks]);

    // Check Printer
    // @ts-ignore
    if (window.electron?.printer) {
      try {
        // @ts-ignore
        const printerStatus = await window.electron.printer.getStatus();
        if (printerStatus.success) {
          checks[2] = {
            name: 'Printer',
            status: printerStatus.status === 'ready' ? 'pass' : 'warning',
            message: printerStatus.status === 'ready' ? 'Printer ready' : `Status: ${printerStatus.status}`,
            details: `Paper: ${printerStatus.paperLevel || 'N/A'}%`
          };
        } else {
          checks[2] = { name: 'Printer', status: 'fail', message: 'Printer offline', details: printerStatus.error };
        }
      } catch (error) {
        checks[2] = { name: 'Printer', status: 'fail', message: 'Printer check failed', details: String(error) };
      }
    } else {
      checks[2] = { name: 'Printer', status: 'warning', message: 'Running in browser mode', details: 'Electron API not available' };
    }
    setDiagnostics([...checks]);

    // Check Card Reader
    // @ts-ignore
    if (window.electron?.payment) {
      try {
        // @ts-ignore
        const paymentStatus = await window.electron.payment.getStatus();
        if (paymentStatus.success) {
          checks[3] = {
            name: 'Card Reader',
            status: 'pass',
            message: `Connected (${paymentStatus.mode || 'unknown'} mode)`,
            details: paymentStatus.status
          };
        } else {
          checks[3] = { name: 'Card Reader', status: 'fail', message: 'Card reader offline', details: paymentStatus.error };
        }
      } catch (error) {
        checks[3] = { name: 'Card Reader', status: 'fail', message: 'Card reader check failed', details: String(error) };
      }
    } else {
      checks[3] = { name: 'Card Reader', status: 'warning', message: 'Running in browser mode', details: 'Electron API not available' };
    }
    setDiagnostics([...checks]);

    // Check Temp Directory (via image:save-blob test)
    // @ts-ignore
    if (window.electron?.image) {
      try {
        // Test by saving a small test file
        const testData = 'data:text/plain;base64,dGVzdA=='; // "test" in base64
        // @ts-ignore
        const saveResult = await window.electron.image.saveBlob(testData, 'diagnostic-test.txt');
        if (saveResult.success) {
          checks[4] = {
            name: 'Temp Directory',
            status: 'pass',
            message: 'Writable',
            details: saveResult.filePath
          };
          // Clean up test file
          // @ts-ignore
          await window.electron.file?.delete?.(saveResult.filePath);
        } else {
          checks[4] = { name: 'Temp Directory', status: 'fail', message: 'Cannot write to temp', details: saveResult.error };
        }
      } catch (error) {
        checks[4] = { name: 'Temp Directory', status: 'fail', message: 'Temp directory check failed', details: String(error) };
      }
    } else {
      checks[4] = { name: 'Temp Directory', status: 'warning', message: 'Running in browser mode', details: 'Electron API not available' };
    }
    setDiagnostics([...checks]);

    // Check Python Bridge & FFmpeg via config
    // @ts-ignore
    if (window.electron?.config) {
      try {
        // @ts-ignore
        const configResult = await window.electron.config.get();
        if (configResult.success) {
          checks[5] = { name: 'Python Bridge', status: 'pass', message: 'Configured', details: 'Config loaded successfully' };
          checks[6] = { name: 'FFmpeg', status: 'pass', message: 'Configured', details: 'Config loaded successfully' };
        } else {
          checks[5] = { name: 'Python Bridge', status: 'warning', message: 'Config not available', details: configResult.error };
          checks[6] = { name: 'FFmpeg', status: 'warning', message: 'Config not available', details: configResult.error };
        }
      } catch (error) {
        checks[5] = { name: 'Python Bridge', status: 'fail', message: 'Check failed', details: String(error) };
        checks[6] = { name: 'FFmpeg', status: 'fail', message: 'Check failed', details: String(error) };
      }
    } else {
      checks[5] = { name: 'Python Bridge', status: 'warning', message: 'Running in browser mode', details: 'Electron API not available' };
      checks[6] = { name: 'FFmpeg', status: 'warning', message: 'Running in browser mode', details: 'Electron API not available' };
    }
    setDiagnostics([...checks]);

    // Check Frame Templates
    try {
      const frameFiles = ['/frame1.png', '/frame2.png', '/frame3.png'];
      const frameChecks = await Promise.all(
        frameFiles.map(async (frame) => {
          try {
            const response = await fetch(frame, { method: 'HEAD' });
            return response.ok;
          } catch {
            return false;
          }
        })
      );
      const foundCount = frameChecks.filter(Boolean).length;
      if (foundCount === frameFiles.length) {
        checks[7] = { name: 'Frame Templates', status: 'pass', message: `${foundCount}/${frameFiles.length} frames found`, details: frameFiles.join(', ') };
      } else if (foundCount > 0) {
        checks[7] = { name: 'Frame Templates', status: 'warning', message: `${foundCount}/${frameFiles.length} frames found`, details: 'Some frames missing' };
      } else {
        checks[7] = { name: 'Frame Templates', status: 'fail', message: 'No frames found', details: 'Check public folder' };
      }
    } catch (error) {
      checks[7] = { name: 'Frame Templates', status: 'fail', message: 'Frame check failed', details: String(error) };
    }
    setDiagnostics([...checks]);

    setIsRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-6 h-6 animate-spin text-blue-500" />;
      case 'pass':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'fail':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <CheckCircle className="w-6 h-6 text-yellow-500" />;
    }
  };

  const getIcon = (name: string) => {
    switch (name) {
      case 'Webcam':
        return <Camera className="w-5 h-5" />;
      case 'Internet Connection':
        return <Wifi className="w-5 h-5" />;
      case 'Printer':
        return <Printer className="w-5 h-5" />;
      case 'Card Reader':
        return <CreditCard className="w-5 h-5" />;
      case 'Temp Directory':
        return <FolderOpen className="w-5 h-5" />;
      case 'Python Bridge':
      case 'FFmpeg':
        return <HardDrive className="w-5 h-5" />;
      case 'Frame Templates':
        return <FolderOpen className="w-5 h-5" />;
      default:
        return <HardDrive className="w-5 h-5" />;
    }
  };

  const passCount = diagnostics.filter(d => d.status === 'pass').length;
  const failCount = diagnostics.filter(d => d.status === 'fail').length;
  const warningCount = diagnostics.filter(d => d.status === 'warning').length;

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">System Diagnostics</h1>
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={runDiagnostics}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
              Re-run
            </Button>
            <Button variant="ghost" onClick={onClose}>
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-100 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{passCount}</div>
            <div className="text-sm text-green-700">Passed</div>
          </div>
          <div className="bg-yellow-100 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
            <div className="text-sm text-yellow-700">Warnings</div>
          </div>
          <div className="bg-red-100 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{failCount}</div>
            <div className="text-sm text-red-700">Failed</div>
          </div>
        </div>

        {/* Camera Preview */}
        {cameraPreview && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Camera Preview</h2>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-md h-48 object-cover bg-black rounded-lg mx-auto"
            />
          </div>
        )}

        {/* Diagnostic Results */}
        <div className="space-y-3">
          {diagnostics.map((diag, index) => (
            <motion.div
              key={diag.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center justify-between p-4 rounded-lg border-2 ${
                diag.status === 'pass' ? 'border-green-200 bg-green-50' :
                diag.status === 'fail' ? 'border-red-200 bg-red-50' :
                diag.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-gray-600">{getIcon(diag.name)}</div>
                <div>
                  <div className="font-semibold">{diag.name}</div>
                  <div className="text-sm text-gray-600">{diag.message}</div>
                  {diag.details && (
                    <div className="text-xs text-gray-500 mt-1 max-w-md truncate">{diag.details}</div>
                  )}
                </div>
              </div>
              {getStatusIcon(diag.status)}
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t text-center text-sm text-gray-500">
          <p>Triple-tap top-right corner to access this screen</p>
          <p>Double-tap bottom of screen to skip current screen</p>
        </div>
      </Card>
    </motion.div>
  );
}
