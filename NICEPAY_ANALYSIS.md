# NicePay Integration Analysis

## Important Discovery

**NicePay is NOT a physical card reader library.** It's an **online payment gateway service** (like Stripe or PayPal for Korea).

---

## What is NicePay?

NicePay is a Korean payment gateway that provides:
- **Online payment processing** (credit cards, bank transfers, mobile payments)
- **Multiple payment methods**: Credit/debit cards, virtual accounts, KakaoPay, NaverPay, PayPal
- **PCI DSS compliant** (they handle sensitive card data, not you)
- **Sandbox environment** for testing
- **Webhook support** for async payment notifications

---

## How NicePay Works (For Your Kiosk)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        KIOSK FLOW                               │
└─────────────────────────────────────────────────────────────────┘

1. User selects "Print Photo (5,000원)"
                    ↓
2. Electron opens BrowserWindow with NicePay payment page
                    ↓
3. User enters card info in NicePay secure payment window
   (Or scans QR code for mobile payment)
                    ↓
4. NicePay processes payment with card issuer
                    ↓
5. NicePay returns result → Electron receives callback
                    ↓
6. Electron backend confirms payment via API call
                    ↓
7. Print photo if payment approved
```

### Payment Flow Diagram

```
┌───────────┐         ┌──────────────┐         ┌─────────────┐         ┌──────────┐
│  Electron │         │   Browser    │         │  NicePay    │         │   Card   │
│   Main    │         │   Window     │         │   Server    │         │  Issuer  │
│  Process  │         │  (Payment)   │         │             │         │          │
└─────┬─────┘         └──────┬───────┘         └──────┬──────┘         └────┬─────┘
      │                      │                        │                     │
      │ 1. Open payment      │                        │                     │
      │    window with       │                        │                     │
      │    orderId + amount  │                        │                     │
      ├─────────────────────>│                        │                     │
      │                      │                        │                     │
      │                      │ 2. Load NicePay        │                     │
      │                      │    JS SDK              │                     │
      │                      ├───────────────────────>│                     │
      │                      │                        │                     │
      │                      │ 3. User enters card    │                     │
      │                      │    details             │                     │
      │                      │                        │                     │
      │                      │ 4. Submit payment      │                     │
      │                      ├───────────────────────>│                     │
      │                      │                        │                     │
      │                      │                        │ 5. Authorize        │
      │                      │                        │    transaction      │
      │                      │                        ├────────────────────>│
      │                      │                        │                     │
      │                      │                        │ 6. Approved/Declined│
      │                      │                        │<────────────────────│
      │                      │                        │                     │
      │                      │ 7. Return authToken    │                     │
      │                      │<───────────────────────┤                     │
      │                      │                        │                     │
      │ 8. Close window,     │                        │                     │
      │    pass tid to main  │                        │                     │
      │<─────────────────────┤                        │                     │
      │                      │                        │                     │
      │ 9. Confirm payment   │                        │                     │
      │    via API (POST)    │                        │                     │
      ├────────────────────────────────────────────────>                     │
      │                      │                        │                     │
      │ 10. Payment result   │                        │                     │
      │     (JSON)           │                        │                     │
      │<────────────────────────────────────────────────                     │
      │                      │                        │                     │
      │ 11. Print photo      │                        │                     │
      │     if approved      │                        │                     │
      │                      │                        │                     │
```

---

## Comparison: NicePay vs Physical Card Reader

| Feature | NicePay (Online Gateway) | Physical Card Reader |
|---------|-------------------------|---------------------|
| **Hardware Required** | None (software only) | USB card reader device |
| **Payment Methods** | Cards, mobile pay, QR codes | Cards only |
| **PCI Compliance** | Handled by NicePay | Your responsibility |
| **Setup Complexity** | Easy (API keys only) | Complex (drivers, hardware) |
| **Cost** | Transaction fees (~2-3%) | Hardware cost + fees |
| **Maintenance** | Zero (cloud service) | Hardware maintenance |
| **Testing** | Sandbox available | Requires test cards/device |
| **Korean Market** | Optimized (KakaoPay, Naver) | Limited support |
| **User Experience** | Familiar payment window | Requires card insertion |

---

## Recommendation: Use NicePay (Better Choice)

### Why NicePay is BETTER for Your Photo Booth:

1. **No Hardware Dependencies**
   - No USB card reader to install/maintain
   - No driver compatibility issues
   - Works on any Windows machine

2. **More Payment Options**
   - Credit/debit cards
   - Mobile payments (KakaoPay, NaverPay)
   - QR code payments
   - Virtual accounts (bank transfer)

3. **Better User Experience**
   - Users can pay with their phone (scan QR)
   - Familiar payment interface
   - No need to carry physical cards

4. **Easier Development**
   - Sandbox testing (no hardware needed)
   - Well-documented APIs
   - Sample code available

5. **Security & Compliance**
   - PCI DSS compliant (NicePay handles sensitive data)
   - No card data stored on kiosk
   - Reduced liability

6. **Korean Market Optimized**
   - Supports all major Korean payment methods
   - Korean language support
   - Local customer support

---

## Implementation Approach

### Option 1: Node.js in Electron (RECOMMENDED)

**Pros:**
- Single JavaScript codebase
- Native integration with Electron
- No subprocess overhead
- Easier debugging

**Tech Stack:**
```javascript
Electron Main Process (Node.js)
  ├─ Express/Fastify server (local)
  ├─ NicePay Node SDK (got/axios for API calls)
  └─ BrowserWindow for payment UI
```

**Flow:**
1. User clicks "Print Photo"
2. Electron creates local Express server
3. Open BrowserWindow → `http://localhost:3000/payment`
4. Page loads NicePay JS SDK → User pays
5. NicePay callback → Local server endpoint
6. Server confirms payment via API
7. Close window → Print photo

### Option 2: Python Bridge (Previous Architecture)

**Pros:**
- Consistent with video processing architecture
- Can reuse Python code if needed

**Cons:**
- Extra subprocess overhead
- More complex IPC communication
- Harder to handle browser integration

---

## Technical Implementation (Option 1 - Node.js)

### 1. Install Dependencies

```bash
npm install express axios uuid
```

### 2. Create Payment Service

```typescript
// electron/services/nicepay.ts
import axios from 'axios';
import express from 'express';
import { BrowserWindow } from 'electron';

export class NicePayService {
  private clientId: string;
  private secretKey: string;
  private server: express.Application;
  private paymentWindow: BrowserWindow | null = null;

  constructor(clientId: string, secretKey: string) {
    this.clientId = clientId;
    this.secretKey = secretKey;
    this.setupServer();
  }

  private setupServer() {
    this.server = express();
    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: true }));

    // Serve payment page
    this.server.get('/payment', (req, res) => {
      res.send(this.getPaymentHTML(req.query));
    });

    // Handle payment callback
    this.server.post('/callback', async (req, res) => {
      const { tid, authResultCode, amount } = req.body;

      if (authResultCode === '0000') {
        // Payment authorized, confirm it
        const result = await this.confirmPayment(tid, amount);
        res.json(result);
      } else {
        res.json({ success: false, error: 'Authorization failed' });
      }
    });

    this.server.listen(3000);
  }

  async processPayment(orderId: string, amount: number): Promise<PaymentResult> {
    return new Promise((resolve, reject) => {
      // Open payment window
      this.paymentWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      this.paymentWindow.loadURL(`http://localhost:3000/payment?orderId=${orderId}&amount=${amount}`);

      // Listen for payment result
      this.paymentWindow.webContents.on('did-finish-load', () => {
        // Payment window loaded
      });

      // Handle window close
      this.paymentWindow.on('closed', () => {
        this.paymentWindow = null;
      });
    });
  }

  private async confirmPayment(tid: string, amount: number): Promise<PaymentResult> {
    const auth = Buffer.from(`${this.clientId}:${this.secretKey}`).toString('base64');

    try {
      const response = await axios.post(
        `https://api.nicepay.co.kr/v1/payments/${tid}`,
        { amount },
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: response.data.resultCode === '0000',
        tid: response.data.tid,
        orderId: response.data.orderId,
        amount: response.data.amount,
        paidAt: response.data.paidAt,
        status: response.data.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private getPaymentHTML(query: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>결제</title>
  <script src="https://pay.nicepay.co.kr/v1/js/"></script>
</head>
<body>
  <h1>결제 진행 중...</h1>
  <script>
    AUTHNICE.requestPay({
      clientId: '${this.clientId}',
      method: 'card',
      orderId: '${query.orderId}',
      amount: ${query.amount},
      goodsName: '사진 인쇄',
      returnUrl: 'http://localhost:3000/callback',
      fnError: function(result) {
        alert('결제 오류: ' + result.errorMsg);
        window.close();
      }
    });
  </script>
</body>
</html>
    `;
  }
}

interface PaymentResult {
  success: boolean;
  tid?: string;
  orderId?: string;
  amount?: number;
  paidAt?: string;
  status?: string;
  error?: string;
}
```

### 3. React Hook for Payment

```typescript
// src/hooks/useNicePay.ts
import { useState, useCallback } from 'react';

export function useNicePay() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const processPayment = useCallback(async (amount: number) => {
    try {
      setStatus('processing');

      const result = await window.electron.processPayment({
        orderId: `ORDER_${Date.now()}`,
        amount,
        goodsName: '사진 인쇄',
      });

      if (result.success) {
        setStatus('success');
        return result;
      } else {
        setStatus('error');
        setError(result.error || '결제 실패');
        throw new Error(result.error);
      }
    } catch (err) {
      setStatus('error');
      setError(err.message);
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, processPayment, reset };
}
```

---

## Configuration

### Sandbox (Testing)

```typescript
// .env
NICEPAY_CLIENT_ID=S2_af4543a0be4d49a98122e01ec2059a56
NICEPAY_SECRET_KEY=9eb85607103646da9f9c02b128f2e5ee
NICEPAY_API_URL=https://sandbox-api.nicepay.co.kr/v1
```

### Production

```typescript
// .env
NICEPAY_CLIENT_ID=your_production_client_id
NICEPAY_SECRET_KEY=your_production_secret_key
NICEPAY_API_URL=https://api.nicepay.co.kr/v1
```

---

## Testing

### 1. Get Sandbox Credentials

1. Sign up at https://www.nicepay.co.kr/
2. Go to 샌드박스 (Sandbox) in merchant admin
3. Get `clientId` and `secretKey`

### 2. Test Payment Flow

```bash
cd mutui-photobooth
npm install express axios uuid

# Run Electron app
npm run electron:dev
```

### 3. Test Cards (Sandbox)

- **Card Number**: 아무 숫자나 (any numbers)
- **Expiry**: 미래 날짜 (any future date)
- **CVC**: 아무 숫자나 (any numbers)
- Sandbox는 실제 결제가 발생하지 않음 (no real charges)

---

## Cost Structure

NicePay fees (approximate):
- **Transaction Fee**: 2.5-3.5% per transaction
- **Monthly Fee**: Variable (depends on volume)
- **Setup Fee**: Usually free

For 5,000원 photo print:
- Transaction fee: ~125-175원
- Net revenue: 4,825-4,875원

---

## Security Considerations

### ✅ Handled by NicePay:
- PCI DSS compliance
- Card data encryption
- Fraud detection
- 3D Secure authentication

### ⚠️ Your Responsibility:
- Secure API keys (use environment variables)
- Validate payment amounts (server-side)
- Implement signature verification
- Log all transactions

---

## Next Steps

1. **Sign up for NicePay sandbox account**
2. **Choose Option 1 (Node.js) or Option 2 (Python)**
3. **Implement payment service in Electron**
4. **Test with sandbox credentials**
5. **Apply for production account**
6. **Deploy to kiosk**

---

## Comparison to Original Plan

| Original Plan | Updated Plan |
|--------------|--------------|
| Physical card reader | NicePay online gateway |
| Python library (TBD) | Node.js SDK (available) |
| USB device integration | BrowserWindow + HTTP |
| Card insertion | Touch/mobile payment |
| Limited payment methods | Multiple payment methods |
| Hardware maintenance | Zero maintenance |

---

## Conclusion

**Recommendation**: Use **NicePay with Node.js integration** (Option 1).

This approach:
- ✅ Simpler to implement
- ✅ No hardware dependencies
- ✅ More payment options for users
- ✅ Better security (PCI compliant)
- ✅ Easier testing (sandbox available)
- ✅ Korean market optimized

The original payment bridge architecture I designed can be simplified significantly since we don't need physical hardware integration.
