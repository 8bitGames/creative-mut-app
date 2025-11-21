// src/pages/HologramPage.tsx
import { useEffect, useState } from 'react';
import { HologramWindow } from '@/components/HologramWindow';

interface HologramState {
  mode: 'logo' | 'result';
  qrCodePath?: string;
  videoPath?: string;
}

export function HologramPage() {
  const [state, setState] = useState<HologramState>({
    mode: 'logo',
  });

  useEffect(() => {
    console.log('🖥️ [HologramPage] Component mounted - Setting up IPC listeners...');

    // CRITICAL: Restore state from main process on mount
    const restoreState = async () => {
      try {
        // @ts-ignore - Electron IPC
        if (window.electron?.hologram) {
          console.log('🔄 [HologramPage] Requesting current hologram state from main process...');
          // @ts-ignore
          const result = await window.electron.hologram.getState();
          if (result.success && result.state) {
            console.log('✅ [HologramPage] Restored state from main process:', result.state);
            const validMode = result.state.mode === 'result' ? 'result' : 'logo';
            setState({
              mode: validMode,
              qrCodePath: result.state.qrCodePath,
              videoPath: result.state.videoPath,
            });
            console.log(`💾 [HologramPage] State restored to mode: ${validMode}`);
          }
        }
      } catch (error) {
        console.error('❌ [HologramPage] Failed to restore state:', error);
      }
    };

    restoreState();

    // Listen for hologram updates from main process
    const handleUpdate = (data: Partial<HologramState>) => {
      console.log('');
      console.log('='.repeat(70));
      console.log('📨 [HologramPage] IPC MESSAGE RECEIVED: hologram:update');
      console.log('='.repeat(70));
      console.log('   Raw data received:', JSON.stringify(data, null, 2));
      console.log(`   Mode: ${data.mode || 'logo'}`);
      if (data.qrCodePath) console.log(`   QR Code: ${data.qrCodePath}`);
      if (data.videoPath) console.log(`   Video: ${data.videoPath}`);

      // Ignore any modes other than 'logo' or 'result' - always default to 'logo'
      const validMode = data.mode === 'result' ? 'result' : 'logo';

      console.log(`🔄 [HologramPage] Setting React state to mode: ${validMode}`);
      setState({
        mode: validMode,
        qrCodePath: data.qrCodePath,
        videoPath: data.videoPath,
      });
      console.log(`✅ [HologramPage] setState() called successfully`);
      console.log('='.repeat(70));
      console.log('');
    };

    // @ts-ignore - Electron IPC
    if (window.electron) {
      console.log('✅ [HologramPage] Electron IPC available - Registering hologram:update listener');
      console.log('   Listener function:', handleUpdate.name || 'anonymous');
      // @ts-ignore
      window.electron.ipcRenderer.on('hologram:update', handleUpdate);
      console.log('✅ [HologramPage] Listener registered successfully on channel: hologram:update');
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
    />
  );
}
