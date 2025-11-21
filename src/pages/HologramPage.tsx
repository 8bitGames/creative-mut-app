// src/pages/HologramPage.tsx
import { useEffect, useState } from 'react';
import { HologramWindow } from '@/components/HologramWindow';

interface HologramState {
  mode: 'logo' | 'result' | 'recording-prep';
  qrCodePath?: string;
  videoPath?: string;
  framePath?: string;
}

export function HologramPage() {
  const [state, setState] = useState<HologramState>({
    mode: 'logo',
  });

  useEffect(() => {
    console.log('🖥️ [HologramPage] Component mounted - Setting up IPC listeners...');

    // Listen for hologram updates from main process
    const handleUpdate = (_event: any, data: HologramState) => {
      console.log('📨 [HologramPage] IPC update received from main process:');
      console.log(`   Mode: ${data.mode}`);
      if (data.qrCodePath) console.log(`   QR Code: ${data.qrCodePath}`);
      if (data.videoPath) console.log(`   Video: ${data.videoPath}`);
      if (data.framePath) console.log(`   Frame: ${data.framePath}`);

      setState(data);
      console.log('✅ [HologramPage] State updated');
    };

    // @ts-ignore - Electron IPC
    if (window.electron) {
      console.log('✅ [HologramPage] Electron IPC available - Registering hologram:update listener');
      // @ts-ignore
      window.electron.ipcRenderer.on('hologram:update', handleUpdate);
    } else {
      console.warn('⚠️ [HologramPage] Electron IPC not available (running in browser)');
    }

    return () => {
      console.log('🛑 [HologramPage] Cleaning up IPC listeners...');
      // @ts-ignore
      if (window.electron) {
        // @ts-ignore
        window.electron.ipcRenderer.removeListener('hologram:update', handleUpdate);
        console.log('✅ [HologramPage] IPC listeners removed');
      }
    };
  }, []);

  return (
    <HologramWindow
      mode={state.mode}
      qrCodePath={state.qrCodePath}
      videoPath={state.videoPath}
      framePath={state.framePath}
    />
  );
}
