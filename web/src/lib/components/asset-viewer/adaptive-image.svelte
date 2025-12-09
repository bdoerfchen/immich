<script lang="ts">
  import { thumbhash } from '$lib/actions/thumbhash';
  import { zoomImageAction } from '$lib/actions/zoom-image';
  import BrokenAsset from '$lib/components/assets/broken-asset.svelte';
  import { imageManager } from '$lib/managers/ImageManager.svelte';
  import { SlideshowLook, SlideshowState } from '$lib/stores/slideshow.store';
  import { photoZoomState, resetZoomState } from '$lib/stores/zoom-image.store';
  import { AdaptiveImageLoader } from '$lib/utils/adaptive-image-loader.svelte';
  import { getAltText } from '$lib/utils/thumbnail-util';
  import { toTimelineAsset } from '$lib/utils/timeline-util';
  import type { AssetResponseDto, SharedLinkResponseDto } from '@immich/sdk';
  import { LoadingSpinner } from '@immich/ui';
  import { onMount, untrack, type Snippet } from 'svelte';

  interface Props {
    asset: AssetResponseDto;
    sharedLink?: SharedLinkResponseDto;
    zoomDisabled?: boolean;
    imageClass?: string;
    width: string;
    height: string;
    slideshowState: SlideshowState;
    slideshowLook: SlideshowLook;
    onImageReady?: () => void;
    onError?: () => void;
    imgElement?: HTMLImageElement;
    overlays?: Snippet;
  }

  let {
    imgElement = $bindable<HTMLImageElement>(),
    asset,
    sharedLink,
    zoomDisabled = false,
    imageClass = '',
    width,
    height,
    slideshowState,
    slideshowLook,
    onImageReady,
    onError,
    overlays,
  }: Props = $props();

  let previousLoader = $state<AdaptiveImageLoader>();

  // Zoom transform for thumbhash/thumbnail layers
  let hashPreviewTransform = $state<string>();

  const adaptiveImageLoader = $derived.by(() => {
    // Cleanup previous loader
    untrack(() => {
      previousLoader?.cleanup();
      resetZoomState();
    });

    // Create new loader for this asset
    const newLoader = new AdaptiveImageLoader(asset, sharedLink, {
      currentZoomFn: () => $photoZoomState.currentZoom,
      onImageReady,
      onError,
    });

    untrack(() => {
      previousLoader = newLoader;
      // Always start with preview - the $effect below will upgrade to original if zoomed
      void newLoader.load();
    });

    return newLoader;
  });

  // Effect: Upgrade to original when user zooms in
  $effect(() => {
    if ($photoZoomState.currentZoom > 1 && loadState.quality === 'preview') {
      imageManager.cancelPreloadUrl(loadState.currentUrl);
      void adaptiveImageLoader.upgradeToOriginal();
    }
  });

  onMount(() => {
    const unsubscribe = photoZoomState.subscribe((state) => {
      hashPreviewTransform = `translate(${state.currentPositionX}px,${state.currentPositionY}px) scale(${state.currentZoom})`;
    });

    return () => {
      adaptiveImageLoader.cleanup();
      unsubscribe();
    };
  });

  const loadState = $derived(adaptiveImageLoader.adaptiveLoaderState);
  const imageAltText = $derived(loadState.currentUrl ? $getAltText(toTimelineAsset(asset)) : '');
  const imageOpacity = $derived(loadState.currentUrl ? '1' : '0');
  const imageSrc = $derived(loadState.currentUrl ?? '');
  const showSpinner = $derived(!asset.thumbhash && loadState.quality === 'basic');
  const showBrokenAsset = $derived(loadState.hasError && loadState.quality !== 'loading-original');
</script>

<div class="relative h-full w-full">
  {#if asset.thumbhash}
    <!-- Thumbhash and thumbnail layer  -->
    {@const thumbKey = loadState.thumbnailUrl + loadState.thumbOpacity}
    <div style:transform-origin="0px 0px" style:transform={hashPreviewTransform} class="h-full w-full absolute">
      <canvas use:thumbhash={{ base64ThumbHash: asset.thumbhash }} class="h-full w-full absolute -z-2"></canvas>
      {#key thumbKey}
        <img
          src={loadState.thumbnailUrl}
          style:opacity={loadState.thumbOpacity}
          alt=""
          class="h-full w-full absolute -z-1"
        />
      {/key}
    </div>
  {:else if showSpinner}
    <div id="spinner" class="absolute flex h-full items-center justify-center">
      <LoadingSpinner />
    </div>
  {/if}

  {#if showBrokenAsset}
    <div class="h-full w-full">
      <BrokenAsset class="text-xl h-full w-full" />
    </div>
  {:else}
    <!-- Slideshow blurred background -->
    {#if loadState.currentUrl && slideshowState !== SlideshowState.None && slideshowLook === SlideshowLook.BlurredBackground}
      <img
        src={loadState.currentUrl}
        alt=""
        class="-z-1 absolute top-0 start-0 object-cover h-full w-full blur-lg"
        draggable="false"
      />
    {/if}

    {#key asset.id}
      <div use:zoomImageAction={{ disabled: zoomDisabled }} style:width style:height>
        <img
          bind:this={imgElement}
          style:opacity={imageOpacity}
          src={imageSrc}
          alt={imageAltText}
          class="h-full w-full {imageClass}"
          draggable="false"
        />

        {@render overlays?.()}
      </div>
    {/key}
  {/if}
</div>

<style>
  @keyframes delayedVisibility {
    to {
      visibility: visible;
    }
  }
  #spinner {
    visibility: hidden;
    animation: 0s linear 0.4s forwards delayedVisibility;
  }
</style>
