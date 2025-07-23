
import { apiRequest } from './queryClient';

class NotificationManager {
  private static vapidPublicKey: string | null = null;
  private static registration: ServiceWorkerRegistration | null = null;

  static isSupported(): { supported: boolean; reason?: string; requiresHomescreenInstall?: boolean } {
    // Enhanced iOS detection per Apple documentation
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isMacOS = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.platform);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edge/.test(navigator.userAgent);
    
    // Apple requires PWA to be installed to home screen for push notifications
    const isStandalone = (window.navigator as any).standalone === true || 
                        window.matchMedia('(display-mode: standalone)').matches;

    // Apple documentation: iOS 16.4+ required for Web Push
    const iOSVersionMatch = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
    const iOSMajorVersion = iOSVersionMatch ? parseInt(iOSVersionMatch[1]) : 0;
    const iOSMinorVersion = iOSVersionMatch ? parseInt(iOSVersionMatch[2]) : 0;
    const iOSVersion = iOSMajorVersion + (iOSMinorVersion / 10);
    
    console.log('🍎 Apple PWA Detection:', {
      isIOS,
      isMacOS,
      isSafari,
      isStandalone,
      iOSVersion: `${iOSMajorVersion}.${iOSMinorVersion}`,
      userAgent: navigator.userAgent
    });

    if (!('serviceWorker' in navigator)) {
      return { supported: false, reason: 'Service Worker not supported' };
    }

    if (!('Notification' in window)) {
      return { supported: false, reason: 'Notifications not supported' };
    }

    if (!('PushManager' in window)) {
      return { supported: false, reason: 'Push messaging not supported' };
    }

    // iOS specific checks
    if (isIOS) {
      if (iOSVersion < 16.4) {
        return { 
          supported: false, 
          reason: `iOS ${iOSVersion} detected. iOS 16.4+ required for Web Push`,
          requiresHomescreenInstall: true
        };
      }

      if (!isStandalone) {
        return { 
          supported: false, 
          reason: 'iOS requires PWA to be installed to home screen for push notifications',
          requiresHomescreenInstall: true
        };
      }
    }

    return { supported: true };
  }

  static async initialize(): Promise<boolean> {
    console.log('🍎 Initializing Apple-compliant NotificationManager...');

    const supportCheck = this.isSupported();
    console.log('🍎 Apple support check:', supportCheck);

    // Apple documentation requirements check
    if (!('serviceWorker' in navigator)) {
      console.warn('❌ Service Workers not supported - required by Apple');
      return false;
    }

    if (!('PushManager' in window)) {
      console.warn('❌ Push messaging not supported - required by Apple');
      return false;
    }

    if (!('Notification' in window)) {
      console.warn('❌ Notifications not supported - required by Apple');
      return false;
    }

    try {
      // Apple requires VAPID authentication
      console.log('🔑 Fetching VAPID public key (Apple requirement)...');
      const response = await fetch('/api/notifications/vapid-key');
      if (!response.ok) {
        throw new Error(`Failed to fetch VAPID key: ${response.status}`);
      }
      const data = await response.json();
      this.vapidPublicKey = data.publicKey;
      console.log('✅ Apple VAPID key obtained:', this.vapidPublicKey?.substring(0, 20) + '...');

      // Apple-specific iOS detection
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isMacOS = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.platform);
      const isIOSDevice = isIOS && !isMacOS;
      const isStandalone = (window.navigator as any).standalone === true || 
                          window.matchMedia('(display-mode: standalone)').matches;

      if (isIOSDevice) {
        console.log('🍎 Apple iOS device detected - applying Apple guidelines...');
        
        // Apple requirement: Must be in standalone mode
        if (!isStandalone) {
          console.warn('⚠️ Apple requires PWA to be installed for push notifications');
          return false;
        }

        // Apple-compliant service worker registration
        console.log('🍎 Registering service worker per Apple requirements...');
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
          type: 'classic'
        });
        
        console.log('✅ Apple-compliant Service Worker registered');
      } else {
        // Standard registration for non-iOS
        console.log('📝 Registering service worker for non-iOS...');
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none'
        });
      }

      console.log('✅ Service Worker registered successfully with scope:', this.registration.scope);

      // Apple requires waiting for service worker to be ready
      console.log('⏳ Waiting for service worker (Apple requirement)...');
      await navigator.serviceWorker.ready;
      
      console.log('✅ Apple-compliant Service Worker is ready');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Apple-compliant notifications:', error);
      if (error instanceof Error) {
        console.error('Apple initialization error:', error.message, error.stack);
      }
      return false;
    }
  }

  static async requestPermission(): Promise<NotificationPermission> {
    console.log('🔔 Requesting notification permission...');

    if (!('Notification' in window)) {
      console.warn('❌ Notifications not supported');
      return 'denied';
    }

    let permission = Notification.permission;
    console.log('📊 Current permission status:', permission);

    if (permission === 'default') {
      console.log('❓ Permission is default, requesting...');
      permission = await Notification.requestPermission();
      console.log('📊 New permission status:', permission);
    }

    return permission;
  }

  static async subscribe(): Promise<boolean> {
    console.log('🍎 Starting Apple-compliant subscription process...');

    if (!this.registration || !this.vapidPublicKey) {
      console.error('❌ Apple notification manager not properly initialized');
      return false;
    }

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      console.warn('❌ Apple notification permission not granted:', permission);
      return false;
    }

    try {
      // Apple iOS detection and validation
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isMacOS = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.platform);
      const isIOSDevice = isIOS && !isMacOS;
      const isStandalone = (window.navigator as any).standalone === true || 
                          window.matchMedia('(display-mode: standalone)').matches;

      if (isIOSDevice) {
        console.log('🍎 Apple iOS device - validating requirements...');
        
        // Apple requirement: Must be in standalone mode
        if (!isStandalone) {
          console.error('❌ Apple iOS push notifications require PWA installation');
          throw new Error('Apple requires app installation to home screen for push notifications');
        }

        // Apple iOS version check
        const versionMatch = navigator.userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
        const majorVersion = versionMatch ? parseInt(versionMatch[1]) : 0;
        const minorVersion = versionMatch ? parseInt(versionMatch[2]) : 0;
        
        if (majorVersion < 16 || (majorVersion === 16 && minorVersion < 4)) {
          throw new Error(`Apple requires iOS 16.4+ for Web Push. Current: ${majorVersion}.${minorVersion}`);
        }

        console.log('✅ Apple iOS requirements met');
      }

      // Clear any existing subscription (Apple best practice)
      console.log('🔍 Checking existing subscription...');
      const existingSubscription = await this.registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        console.log('🔄 Removing existing subscription (Apple best practice)...');
        await existingSubscription.unsubscribe();
        console.log('✅ Existing subscription removed');
        
        // Apple recommends waiting after unsubscription
        await new Promise(resolve => setTimeout(resolve, isIOSDevice ? 2000 : 500));
      }

      // Apple-compliant subscription options
      console.log('📝 Creating Apple-compliant push subscription...');
      const subscribeOptions: PushSubscriptionOptions = {
        userVisibleOnly: true, // Apple requirement
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      };

      const subscription = await this.registration.pushManager.subscribe(subscribeOptions);

      console.log('✅ Apple push subscription created!');
      console.log('🔧 Apple subscription details:', {
        endpoint: subscription.endpoint.includes('apple') ? 'Apple Push Service' : 'Other Service',
        endpointLength: subscription.endpoint.length,
        hasP256dh: !!subscription.getKey('p256dh'),
        hasAuth: !!subscription.getKey('auth')
      });

      // Send to server with Apple-specific handling
      console.log('📤 Sending Apple subscription to server...');
      const subscriptionData = {
        endpoint: subscription.endpoint,
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')),
        userAgent: navigator.userAgent, // For Apple endpoint detection
        isApple: isIOSDevice
      };

      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': navigator.userAgent
        },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        throw new Error(`Apple subscription server error: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('✅ Apple subscription saved to server:', responseData);

      // Apple test notification (delayed for processing)
      if (isIOSDevice) {
        console.log('🧪 Sending Apple test notification...');
        setTimeout(async () => {
          try {
            const testResponse = await fetch('/api/notifications/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            if (testResponse.ok) {
              console.log('✅ Apple test notification sent');
            }
          } catch (testError) {
            console.warn('⚠️ Apple test notification failed:', testError);
          }
        }, 3000); // Apple recommends delay
      }

      console.log('✅ Apple push notifications successfully enabled');
      return true;
    } catch (error) {
      console.error('❌ Apple push subscription failed:', error);

      if (error instanceof Error) {
        console.error('❌ Apple error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }

      return false;
    }
  }

  static async unsubscribe(): Promise<boolean> {
    console.log('🔕 Starting unsubscribe process...');

    if (!this.registration) {
      console.warn('⚠️ No registration found');
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        console.log('🔄 Unsubscribing from push manager...');
        await subscription.unsubscribe();

        // Remove subscription from server
        console.log('📤 Removing subscription from server...');
        await apiRequest('DELETE', '/api/notifications/unsubscribe', {
          endpoint: subscription.endpoint,
        });

        console.log('✅ Successfully unsubscribed from push notifications');
      } else {
        console.log('ℹ️ No active subscription found');
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  static async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      const isSubscribed = subscription !== null;
      console.log('📊 Subscription status:', isSubscribed);
      return isSubscribed;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }

  private static urlBase64ToUint8Array(base64String: string): Uint8Array {
    try {
      console.log('🔧 Converting VAPID key, input length:', base64String.length);
      
      // Ensure the base64 string is properly formatted
      let base64 = base64String.replace(/-/g, '+').replace(/_/g, '/');
      
      // Add padding if necessary
      const padding = '='.repeat((4 - (base64.length % 4)) % 4);
      base64 += padding;
      
      console.log('🔧 After padding, length:', base64.length);
      
      // For iOS Safari, ensure we handle the base64 conversion carefully
      let rawData: string;
      try {
        rawData = window.atob(base64);
      } catch (atobError) {
        console.error('❌ Base64 decode error:', atobError);
        // Try without padding as fallback
        rawData = window.atob(base64String.replace(/-/g, '+').replace(/_/g, '/'));
      }
      
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }

      console.log('✅ VAPID key converted successfully, output length:', outputArray.length);
      return outputArray;
    } catch (error) {
      console.error('❌ Failed to convert VAPID key:', error);
      console.error('Input string:', base64String);
      throw error;
    }
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) return '';

    try {
      const bytes = new Uint8Array(buffer);
      let binary = '';

      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }

      return window.btoa(binary);
    } catch (error) {
      console.error('❌ Failed to convert buffer to base64:', error);
      return '';
    }
  }
}

class NotificationService {
  private vapidPublicKey: string | null = null;

  async initialize(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered successfully');

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log('✅ Service Worker is ready');
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
        throw error;
      }
    } else {
      console.error('❌ Service Worker not supported in this browser');
      throw new Error('Service Worker not supported');
    }

    // Get VAPID public key
    try {
      const response = await fetch('/api/notifications/vapid-key');
      if (!response.ok) {
        throw new Error(`Failed to fetch VAPID key: ${response.status}`);
      }
      const data = await response.json();
      this.vapidPublicKey = data.publicKey;
      console.log('✅ VAPID public key obtained');
    } catch (error) {
      console.error('❌ Failed to get VAPID public key:', error);
      throw error;
    }
  }

  async subscribe(): Promise<boolean> {
    try {
      console.log('🔔 Starting notification subscription process...');

      if (!this.vapidPublicKey) {
        console.error('❌ VAPID public key not available, initializing...');
        await this.initialize();
        if (!this.vapidPublicKey) {
          throw new Error('VAPID public key still not available');
        }
      }

      console.log('📋 Checking for existing subscription...');
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('♻️ Existing subscription found, verifying with server...');

        // Verify with server
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: existingSubscription.endpoint,
            p256dh: this.arrayBufferToBase64(existingSubscription.getKey('p256dh')!),
            auth: this.arrayBufferToBase64(existingSubscription.getKey('auth')!),
          }),
        });

        if (response.ok) {
          console.log('✅ Existing subscription verified with server');
          return true;
        }
      }

      console.log('📝 Creating new push subscription...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      });

      console.log('📤 Sending subscription to server...');
      const subscriptionData = {
        endpoint: subscription.endpoint,
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
      };

      console.log('📊 Subscription data:', {
        endpoint: subscriptionData.endpoint.substring(0, 50) + '...',
        p256dhLength: subscriptionData.p256dh.length,
        authLength: subscriptionData.auth.length
      });

      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscriptionData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Server subscription failed: ${response.status} - ${errorData.message}`);
      }

      const responseData = await response.json();
      console.log('✅ Subscription successful:', responseData);
      return true;
    } catch (error) {
      console.error('❌ Subscription failed:', error);
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
    try {
      console.log('🗑️ Starting unsubscribe process...');

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        console.log('📤 Unsubscribing from push manager...');
        await subscription.unsubscribe();

        console.log('📤 Notifying server of unsubscription...');
        const response = await fetch('/api/notifications/unsubscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });

        if (response.ok) {
          console.log('✅ Successfully unsubscribed');
          return true;
        } else {
          console.error('❌ Server unsubscribe failed:', response.status);
          return false;
        }
      } else {
        console.log('ℹ️ No subscription found to unsubscribe');
        return true;
      }
    } catch (error) {
      console.error('❌ Unsubscribe failed:', error);
      return false;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return window.btoa(binary);
  }
}

// Create a default instance for backward compatibility
export const notificationService = new NotificationService();

// Export NotificationManager as default (only one export)
export default NotificationManager;
