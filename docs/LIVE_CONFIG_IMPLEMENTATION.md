# Live Cloud Config Implementation

## Overview

This document describes the implementation of live cloud configuration updates for the MUT Hologram Studio Electron app. The goal is to allow all app parameters to be updated from the cloud dashboard without requiring an app restart.

## Architecture

### Current Flow (Before)
```
Cloud Dashboard → configSync.sync() → appConfig.update() → Config stored but NOT applied to running components
```

### New Flow (After)
```
Cloud Dashboard
     │
     ▼
configSync.onChange()
     │
     ├─── At Idle Screen ───► Apply Immediately
     │
     └─── Mid-Session ──────► Queue as pendingConfig
                                    │
                              Screen → 'idle'
                                    │
                                    ▼
                            applyPendingConfig()
                                    │
            ┌───────────┬───────────┼───────────┬───────────┐
            ▼           ▼           ▼           ▼           ▼
        Camera     CardReader   Display    Payment     Printer
       reinit()    reinit()   reconfig()   (auto)      (auto)
```

## Configuration Categories

### Category 1: Stateless Settings (Apply Instantly)
These settings are read on-demand, so updating the config singleton is sufficient.

| Setting | Location | When Read |
|---------|----------|-----------|
| `payment.useMockMode` | Per transaction | When payment starts |
| `payment.defaultAmount` | Per transaction | When payment starts |
| `printer.mockMode` | Per print job | When print starts |
| `debug.logLevel` | Per log entry | Each log call |
| `debug.enableLogging` | Per log entry | Each log call |
| `demo.enabled` | Per screen load | Frame selection screen |
| `demo.videoPath` | Per screen load | Frame selection screen |

### Category 2: Stateful Settings (Require Reinitialization)
These settings are used to initialize hardware controllers and need explicit reinitialization.

| Setting | Component | Reinit Method |
|---------|-----------|---------------|
| `camera.useWebcam` | CameraController | `reinitializeCamera()` |
| `camera.mockMode` | CameraController | `reinitializeCamera()` |
| `tl3600.port` | CardReaderController | `reinitializeCardReader()` |
| `tl3600.terminalId` | CardReaderController | `reinitializeCardReader()` |
| `payment.useMockMode` | CardReaderController | `reinitializeCardReader()` |

### Category 3: Display Settings (Require Window Reconfiguration)
These settings affect window layout and positioning.

| Setting | Effect |
|---------|--------|
| `display.splitScreenMode` | Show/hide hologram window |
| `display.swapDisplays` | Swap window positions between monitors |
| `display.mainWidth` | Resize main window |
| `display.mainHeight` | Resize main window |
| `display.hologramWidth` | Resize hologram window |
| `display.hologramHeight` | Resize hologram window |

## Implementation Details

### 1. IPC Communication (preload.ts)

Add new IPC methods for screen state communication:

```typescript
// Renderer → Main: Notify screen change
app: {
  notifyScreenChange: (screen: string) => ipcRenderer.send('app:screen-changed', screen),
  onConfigUpdated: (callback: (config: any) => void) => {
    const listener = (_event: any, config: any) => callback(config);
    ipcRenderer.on('app:config-updated', listener);
    return () => ipcRenderer.removeListener('app:config-updated', listener);
  },
}
```

### 2. Screen State Tracking (main.ts)

Track the current renderer screen state:

```typescript
let currentRendererScreen: string = 'idle';
let pendingConfigChanges: { newConfig: AppConfig; oldConfig: AppConfig } | null = null;
let isApplyingConfig = false;

ipcMain.on('app:screen-changed', (_event, screen: string) => {
  const previousScreen = currentRendererScreen;
  currentRendererScreen = screen;

  console.log(`📱 [Main] Screen changed: ${previousScreen} → ${screen}`);

  // Apply pending config when returning to idle
  if (screen === 'idle' && pendingConfigChanges && !isApplyingConfig) {
    applyPendingConfig();
  }
});
```

### 3. Config Change Listener (main.ts)

Listen for config changes from cloud sync:

```typescript
// In initializeCloudIntegration():
configSync.onChange(async (newConfig, oldConfig) => {
  console.log('☁️ [Main] Config changed from cloud');

  if (currentRendererScreen === 'idle' && !isApplyingConfig) {
    // Apply immediately if at idle
    await applyConfigChanges(newConfig, oldConfig);
  } else {
    // Queue for later
    pendingConfigChanges = { newConfig, oldConfig };
    console.log('📋 [Main] Config changes queued - will apply at idle screen');
  }
});
```

### 4. Hardware Reinitialization Functions (main.ts)

#### reinitializeCamera()
```typescript
async function reinitializeCamera(newCameraConfig: CameraConfig): Promise<void> {
  console.log('📷 [Main] Reinitializing camera...');

  if (cameraController) {
    await cameraController.disconnect();
    cameraController = null;
  }

  cameraController = new CameraController({
    useWebcam: newCameraConfig.useWebcam,
    mockMode: newCameraConfig.mockMode,
  });

  const result = await cameraController.connect();
  if (result.success) {
    console.log('📷 [Main] Camera reinitialized successfully');
  } else {
    console.error('📷 [Main] Camera reinitialization failed:', result.error);
  }

  updatePeripheralStatus();
}
```

#### reinitializeCardReader()
```typescript
async function reinitializeCardReader(config: AppConfig): Promise<void> {
  console.log('💳 [Main] Reinitializing card reader...');

  if (cardReader) {
    await cardReader.disconnect();
    cardReader = null;
  }

  cardReader = new CardReaderController({
    mockMode: config.payment.useMockMode,
    readerPort: config.tl3600.port,
    terminalId: config.tl3600.terminalId,
    mockApprovalRate: config.payment.mockApprovalRate,
  });

  const result = await cardReader.connect();
  if (result.success) {
    console.log('💳 [Main] Card reader reinitialized successfully');
  } else {
    console.error('💳 [Main] Card reader reinitialization failed:', result.error);
  }

  updatePeripheralStatus();
}
```

### 5. Window Reconfiguration Function (main.ts)

```typescript
async function reconfigureWindows(newDisplayConfig: DisplayConfig): Promise<void> {
  console.log('🖥️ [Main] Reconfiguring windows...');

  const displays = screen.getAllDisplays();

  // Update display settings
  displaySettings = {
    splitScreenMode: newDisplayConfig.splitScreenMode,
    swapDisplays: newDisplayConfig.swapDisplays,
    mainWidth: newDisplayConfig.mainWidth,
    mainHeight: newDisplayConfig.mainHeight,
    hologramWidth: newDisplayConfig.hologramWidth,
    hologramHeight: newDisplayConfig.hologramHeight,
  };

  if (newDisplayConfig.splitScreenMode) {
    // Single window mode - hide hologram window
    if (hologramWindow) {
      hologramWindow.hide();
    }
    // Resize main window for split view
    if (mainWindow) {
      mainWindow.setSize(newDisplayConfig.mainWidth, newDisplayConfig.mainHeight);
    }
  } else {
    // Dual monitor mode
    const [display1, display2] = displays;
    const mainDisplay = newDisplayConfig.swapDisplays ? display2 : display1;
    const hologramDisplay = newDisplayConfig.swapDisplays ? display1 : display2;

    if (mainWindow && mainDisplay) {
      mainWindow.setBounds({
        x: mainDisplay.bounds.x,
        y: mainDisplay.bounds.y,
        width: newDisplayConfig.mainWidth,
        height: newDisplayConfig.mainHeight,
      });
    }

    if (hologramWindow && hologramDisplay) {
      hologramWindow.setBounds({
        x: hologramDisplay.bounds.x,
        y: hologramDisplay.bounds.y,
        width: newDisplayConfig.hologramWidth,
        height: newDisplayConfig.hologramHeight,
      });
      hologramWindow.show();
    }
  }

  console.log('🖥️ [Main] Windows reconfigured successfully');
}
```

### 6. Main Apply Function (main.ts)

```typescript
async function applyConfigChanges(newConfig: AppConfig, oldConfig: AppConfig): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('⚡ APPLYING LIVE CONFIG CHANGES');
  console.log('='.repeat(60));

  // Camera changes
  const cameraChanged =
    newConfig.camera.useWebcam !== oldConfig.camera.useWebcam ||
    newConfig.camera.mockMode !== oldConfig.camera.mockMode;

  if (cameraChanged) {
    await reinitializeCamera(newConfig.camera);
  }

  // Card reader changes
  const cardReaderChanged =
    newConfig.tl3600.port !== oldConfig.tl3600.port ||
    newConfig.tl3600.terminalId !== oldConfig.tl3600.terminalId ||
    newConfig.payment.useMockMode !== oldConfig.payment.useMockMode;

  if (cardReaderChanged) {
    await reinitializeCardReader(newConfig);
  }

  // Display changes
  const displayChanged =
    newConfig.display.splitScreenMode !== oldConfig.display.splitScreenMode ||
    newConfig.display.swapDisplays !== oldConfig.display.swapDisplays ||
    newConfig.display.mainWidth !== oldConfig.display.mainWidth ||
    newConfig.display.mainHeight !== oldConfig.display.mainHeight ||
    newConfig.display.hologramWidth !== oldConfig.display.hologramWidth ||
    newConfig.display.hologramHeight !== oldConfig.display.hologramHeight;

  if (displayChanged) {
    await reconfigureWindows(newConfig.display);
  }

  // Notify renderer
  mainWindow?.webContents.send('app:config-updated', newConfig);

  console.log('='.repeat(60));
  console.log('✅ LIVE CONFIG CHANGES APPLIED');
  console.log('='.repeat(60) + '\n');
}

async function applyPendingConfig(): Promise<void> {
  if (!pendingConfigChanges || isApplyingConfig) return;

  isApplyingConfig = true;
  console.log('📋 [Main] Applying pending config changes...');

  try {
    await applyConfigChanges(
      pendingConfigChanges.newConfig,
      pendingConfigChanges.oldConfig
    );
    pendingConfigChanges = null;
  } catch (error) {
    console.error('❌ [Main] Failed to apply pending config:', error);
  } finally {
    isApplyingConfig = false;
  }
}
```

### 7. Frontend Integration (App.tsx)

```typescript
// Notify main process on screen changes
useEffect(() => {
  if (window.electron?.app?.notifyScreenChange) {
    window.electron.app.notifyScreenChange(currentScreen);
  }
}, [currentScreen]);

// Listen for config updates (optional - for UI refresh)
useEffect(() => {
  if (window.electron?.app?.onConfigUpdated) {
    const unsubscribe = window.electron.app.onConfigUpdated((config) => {
      console.log('📋 [App] Config updated from cloud:', config);
      // Could trigger UI refresh here if needed
    });
    return unsubscribe;
  }
}, []);
```

## Testing Plan

### Test Case 1: Payment Settings
1. Start app, go to payment screen
2. Change `payment.mockMode` in cloud dashboard
3. Cancel payment, return to idle
4. Start new payment - verify mock mode changed

### Test Case 2: Camera Settings
1. Start app with webcam mode
2. Change `camera.useWebcam` to false in cloud dashboard
3. Return to idle - camera should reinitialize
4. Start capture - verify DSLR mode active

### Test Case 3: Display Settings
1. Start app in dual monitor mode
2. Change `display.splitScreenMode` to true in cloud dashboard
3. Return to idle - hologram window should hide
4. Verify single window mode active

### Test Case 4: Mid-Session Changes
1. Start a session (go to capture screen)
2. Push config changes from cloud dashboard
3. Verify changes are queued (not applied)
4. Complete session, return to idle
5. Verify changes are applied

## Safety Considerations

1. **Mutex Protection**: `isApplyingConfig` flag prevents concurrent config applications
2. **Idle-Only Application**: Stateful changes only apply at idle screen
3. **Hardware Disconnection**: Proper disconnect before reinitialize
4. **Error Handling**: Failed reinitialization doesn't crash app
5. **Heartbeat Updates**: Peripheral status updated after reinit

## Files Modified

| File | Changes |
|------|---------|
| `electron/preload.ts` | Add `app.notifyScreenChange()` and `app.onConfigUpdated()` |
| `electron/main.ts` | Add screen tracking, config listener, reinit functions |
| `src/App.tsx` | Add useEffect for screen change notification |
| `src/types/electron.d.ts` | Add TypeScript types for new IPC methods |

## Rollback Plan

If issues arise, the feature can be disabled by:
1. Removing the `configSync.onChange()` listener in main.ts
2. The app will continue working with startup-only config loading
