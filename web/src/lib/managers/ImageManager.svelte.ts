import { getAssetUrl } from '$lib/utils';
import { cancelImageUrl, preloadImageUrl } from '$lib/utils/sw-messaging';
import { AssetTypeEnum, type AssetResponseDto } from '@immich/sdk';

class ImageManager {
  private activeLoadCount = 0;
  private preloadQueue: AssetResponseDto[] = [];
  private pendingPreloads = new Map<string, ReturnType<typeof setTimeout> | null>();

  preload(asset: AssetResponseDto | undefined) {
    if (!asset) {
      return;
    }

    // Clear any cancellation marker and remove from queue (fresh preload request)
    if (this.pendingPreloads.get(asset.id) === null) {
      this.pendingPreloads.delete(asset.id);
      this.removeFromQueue(asset.id);
    }

    // Queue preload if there are active high-priority loads
    if (this.activeLoadCount > 0) {
      this.addToQueue(asset);
      return;
    }

    this.schedulePreload(asset);
  }

  private addToQueue(asset: AssetResponseDto) {
    if (!this.preloadQueue.some((queued) => queued.id === asset.id)) {
      this.preloadQueue.push(asset);
    }
  }

  private removeFromQueue(assetId: string) {
    this.preloadQueue = this.preloadQueue.filter((queued) => queued.id !== assetId);
  }

  private schedulePreload(asset: AssetResponseDto) {
    // Don't schedule if this asset has been cancelled
    if (this.pendingPreloads.get(asset.id) === null) {
      return;
    }

    // Cancel any existing pending preload for this asset
    const existingTimeout = this.pendingPreloads.get(asset.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Delay preloads by 250ms to prevent bandwidth contention with
    // main image loads (#loadImage)
    const timeoutId = setTimeout(() => {
      // Check if this timeout is still valid
      const currentTimeout = this.pendingPreloads.get(asset.id);
      if (currentTimeout !== timeoutId) {
        return;
      }

      this.pendingPreloads.delete(asset.id);

      // Don't execute if there are active primary loads - requeue instead
      if (this.activeLoadCount > 0) {
        this.addToQueue(asset);
        return;
      }

      this.executePreload(asset);
    }, 250);

    this.pendingPreloads.set(asset.id, timeoutId);
  }

  private executePreload(asset: AssetResponseDto) {
    if (asset.type !== AssetTypeEnum.Image) {
      return;
    }
    if (globalThis.isSecureContext) {
      preloadImageUrl(getAssetUrl({ asset }));
      return;
    }
    const img = new Image();
    const url = getAssetUrl({ asset });
    if (!url) {
      return;
    }
    img.src = url;
  }

  /**
   * Load an image and return a promise that resolves when ready.
   * @param mode - 'load' resolves on load event, 'decode' resolves when decoded
   */
  loadImage(url: string, mode: 'load' | 'decode' = 'load'): Promise<{ url: string }> {
    return new Promise((resolve, reject) => {
      this.activeLoadCount++;
      const img = new Image();

      const complete = () => {
        this.activeLoadCount--;
        this.flushPreloadQueue();
        resolve({ url });
      };

      let errored = false;
      const error = (message: string) => {
        if (errored) {
          return;
        }
        errored = true;
        this.activeLoadCount--;
        this.flushPreloadQueue();
        reject(new Error(message));
      };

      if (mode === 'load') {
        img.addEventListener('load', complete, { once: true });
      }

      img.addEventListener('error', () => error(`Failed to load image: ${url}`), { once: true });
      img.src = url;

      if (mode === 'decode') {
        img.decode().then(complete, () => error(`Failed to decode image: ${url}`));
      }
    });
  }

  private flushPreloadQueue() {
    if (this.activeLoadCount > 0 || this.preloadQueue.length === 0) {
      return;
    }
    const queue = [...this.preloadQueue];
    this.preloadQueue = [];
    for (const asset of queue) {
      this.schedulePreload(asset);
    }
  }

  cancel(asset: AssetResponseDto | undefined) {
    if (!asset) {
      return;
    }

    // Clear pending timeout and mark as cancelled
    const pendingTimeout = this.pendingPreloads.get(asset.id);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
    }
    this.pendingPreloads.set(asset.id, null);

    // Remove from queue
    this.removeFromQueue(asset.id);

    // Cancel service worker preload if applicable
    if (globalThis.isSecureContext) {
      cancelImageUrl(getAssetUrl({ asset }));
    }
  }

  cancelPreloadUrl(url: string | undefined) {
    if (!globalThis.isSecureContext) {
      return;
    }
    cancelImageUrl(url);
  }
}

export const imageManager = new ImageManager();
