import { imageManager } from '$lib/managers/ImageManager.svelte';
import { getAssetThumbnailUrl, getAssetUrl } from '$lib/utils';
import { AssetMediaSize, type AssetResponseDto, type SharedLinkResponseDto } from '@immich/sdk';

/**
 * Quality levels for progressive image loading
 */
type ImageQuality =
  | 'basic'
  | 'loading-thumbnail'
  | 'thumbnail'
  | 'loading-preview'
  | 'preview'
  | 'loading-original'
  | 'original';

export interface ImageLoaderState {
  currentUrl?: string;
  thumbnailUrl?: string;
  quality: ImageQuality;
  hasError: boolean;
  thumbOpacity: string;
}

/**
 * Coordinates adaptive loading of a single asset image:
 * thumbhash → thumbnail → preview → original (on zoom)
 *
 */
export class AdaptiveImageLoader {
  private state = $state<ImageLoaderState>({
    quality: 'basic',
    hasError: false,
    thumbOpacity: '1',
  });

  private readonly currentZoomFn: () => number;
  private readonly onImageReady?: () => void;
  private readonly onError?: () => void;
  private readonly thumbnailUrl: string;
  private readonly previewUrl: string | undefined;
  private readonly originalUrl: string | undefined;

  constructor(
    asset: AssetResponseDto,
    sharedLink: SharedLinkResponseDto | undefined,
    callbacks: {
      currentZoomFn: () => number;
      onImageReady?: () => void;
      onError?: () => void;
    },
  ) {
    this.currentZoomFn = callbacks.currentZoomFn;
    this.onImageReady = callbacks.onImageReady;
    this.onError = callbacks.onError;

    this.thumbnailUrl = getAssetThumbnailUrl({
      id: asset.id,
      size: AssetMediaSize.Thumbnail,
      cacheKey: asset.thumbhash,
    });
    this.previewUrl = getAssetUrl({ asset, sharedLink });
    this.originalUrl = getAssetUrl({ asset, sharedLink, forceOriginal: true });
  }

  get adaptiveLoaderState(): ImageLoaderState {
    return this.state;
  }

  /**
   * Start loading sequence for an asset
   */
  async load(): Promise<boolean> {
    // Step 1: Load thumbnail
    const thumbSuccess = await this.loadThumbnail();
    if (!thumbSuccess) {
      return false;
    }

    // Step 2: Load preview or original based on zoom
    const wantsOriginal = this.currentZoomFn?.() > 1;
    return wantsOriginal ? await this.loadOriginal() : await this.loadPreview();
  }

  async upgradeToOriginal(): Promise<void> {
    if (this.state.quality !== 'preview' && this.state.quality !== 'loading-preview') {
      return;
    }
    await this.loadOriginal();
  }

  private async loadThumbnail(): Promise<boolean> {
    this.state.thumbnailUrl = this.thumbnailUrl;
    this.state.quality = 'loading-thumbnail';

    try {
      await imageManager.loadImage(this.thumbnailUrl, 'load');
      this.state.quality = 'thumbnail';
      this.state.thumbOpacity = '1';
      return true;
    } catch {
      this.state.thumbOpacity = '0';
      return true; // Continue even if thumbnail fails
    }
  }

  private async loadPreview(): Promise<boolean> {
    if (!this.previewUrl) {
      this.state.hasError = true;
      this.onError?.();
      return false;
    }

    this.state.quality = 'loading-preview';
    try {
      // Set URL immediately for progressive decode
      this.state.currentUrl = this.previewUrl;
      await imageManager.loadImage(this.previewUrl, 'decode');

      this.state.quality = 'preview';
      this.state.hasError = false;
      this.onImageReady?.();
      return true;
    } catch {
      this.state.currentUrl = undefined;
      this.state.hasError = true;
      this.onError?.();
      return false;
    }
  }

  private async loadOriginal(): Promise<boolean> {
    if (!this.originalUrl) {
      return false;
    }

    this.state.quality = 'loading-original';

    try {
      const { url } = await imageManager.loadImage(this.originalUrl, 'decode');

      this.state.currentUrl = url;
      this.state.quality = 'original';
      this.state.hasError = false;
      this.onImageReady?.();
      return true;
    } catch {
      // Don't clear currentUrl on original load failure - keep showing preview
      return false;
    }
  }

  /**
   * Cleanup resources for this asset
   */
  cleanup(): void {
    imageManager.cancelPreloadUrl(this.thumbnailUrl);
    imageManager.cancelPreloadUrl(this.previewUrl);
    imageManager.cancelPreloadUrl(this.originalUrl);
  }
}
