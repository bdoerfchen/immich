<script lang="ts">
  import { shortcuts } from '$lib/actions/shortcut';
  import AdaptiveImage from '$lib/components/asset-viewer/adaptive-image.svelte';
  import FaceEditor from '$lib/components/asset-viewer/face-editor/face-editor.svelte';
  import OcrBoundingBox from '$lib/components/asset-viewer/ocr-bounding-box.svelte';
  import { castManager } from '$lib/managers/cast-manager.svelte';
  import { photoViewerImgElement } from '$lib/stores/assets-store.svelte';
  import { isFaceEditMode } from '$lib/stores/face-edit.svelte';
  import { ocrManager } from '$lib/stores/ocr.svelte';
  import { boundingBoxesArray } from '$lib/stores/people.store';
  import { SlideshowState, slideshowLookCssMapping, slideshowStore } from '$lib/stores/slideshow.store';
  import { photoZoomState } from '$lib/stores/zoom-image.store';
  import { handlePromiseError } from '$lib/utils';
  import { canCopyImageToClipboard, copyImageToClipboard, getDimensions } from '$lib/utils/asset-utils';
  import { handleError } from '$lib/utils/handle-error';
  import { scaleToFit } from '$lib/utils/layout-utils';
  import { getOcrBoundingBoxes } from '$lib/utils/ocr-utils';
  import { getBoundingBox } from '$lib/utils/people-utils';
  import { type SharedLinkResponseDto } from '@immich/sdk';
  import { toastManager } from '@immich/ui';
  import { onDestroy } from 'svelte';
  import { t } from 'svelte-i18n';
  import type { AssetCursor } from './asset-viewer.svelte';

  interface Props {
    cursor: AssetCursor;
    element?: HTMLDivElement;
    sharedLink?: SharedLinkResponseDto;
    onReady?: () => void;
    copyImage?: () => Promise<void>;
    zoomToggle?: () => void;
  }

  let {
    cursor,
    element = $bindable(),
    sharedLink,
    onReady,
    copyImage = $bindable(),
    zoomToggle = $bindable(),
  }: Props = $props();

  const { slideshowState, slideshowLook } = slideshowStore;
  const asset = $derived(cursor.current);

  const imageDimensions = $derived.by(() => {
    if ((asset.width ?? 0) > 0 && (asset.height ?? 0) > 0) {
      return { width: asset.width!, height: asset.height! };
    } else if (asset.exifInfo?.exifImageHeight && asset.exifInfo.exifImageWidth) {
      return getDimensions(asset.exifInfo) as { width: number; height: number };
    } else {
      return { width: 1, height: 1 };
    }
  });

  onDestroy(() => {
    $boundingBoxesArray = [];
  });

  let ocrBoxes = $derived(
    ocrManager.showOverlay && $photoViewerImgElement
      ? getOcrBoundingBoxes(ocrManager.data, $photoZoomState, $photoViewerImgElement)
      : [],
  );

  let isOcrActive = $derived(ocrManager.showOverlay);

  copyImage = async () => {
    if (!canCopyImageToClipboard() || !$photoViewerImgElement) {
      return;
    }

    try {
      await copyImageToClipboard($photoViewerImgElement);
      toastManager.info($t('copied_image_to_clipboard'));
    } catch (error) {
      handleError(error, $t('copy_error'));
    }
  };

  zoomToggle = () => {
    photoZoomState.set({
      ...$photoZoomState,
      currentZoom: $photoZoomState.currentZoom > 1 ? 1 : 2,
    });
  };

  const onPlaySlideshow = () => ($slideshowState = SlideshowState.PlaySlideshow);

  $effect(() => {
    if (isFaceEditMode.value && $photoZoomState.currentZoom > 1) {
      zoomToggle();
    }
  });

  const onCopyShortcut = (event: KeyboardEvent) => {
    if (globalThis.getSelection()?.type === 'Range') {
      return;
    }
    event.preventDefault();
    handlePromiseError(copyImage());
  };

  let currentPreviewUrl = $state<string>();

  $effect(() => {
    if (currentPreviewUrl) {
      void cast(currentPreviewUrl);
    }
  });

  const cast = async (url: string) => {
    if (!url || !castManager.isCasting) {
      return;
    }
    const fullUrl = new URL(url, globalThis.location.href);

    try {
      await castManager.loadMedia(fullUrl.href);
    } catch (error) {
      handleError(error, 'Unable to cast');
      return;
    }
  };

  let containerWidth = $state(0);
  let containerHeight = $state(0);
  const container = $derived({
    width: containerWidth,
    height: containerHeight,
  });

  const scaledDimensions = $derived(scaleToFit(imageDimensions, container));

  const box = $derived.by(() => {
    const { width, height } = scaledDimensions;
    return {
      width: width + 'px',
      height: height + 'px',
      left: (containerWidth - width) / 2 + 'px',
      top: (containerHeight - height) / 2 + 'px',
    };
  });
</script>

<svelte:document
  use:shortcuts={[
    { shortcut: { key: 'z' }, onShortcut: zoomToggle, preventDefault: true },
    { shortcut: { key: 's' }, onShortcut: onPlaySlideshow, preventDefault: true },
    { shortcut: { key: 'c', ctrl: true }, onShortcut: onCopyShortcut, preventDefault: false },
    { shortcut: { key: 'c', meta: true }, onShortcut: onCopyShortcut, preventDefault: false },
    { shortcut: { key: 'z' }, onShortcut: zoomToggle, preventDefault: false },
  ]}
/>

<div
  bind:this={element}
  class="relative h-full w-full select-none"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
>
  <div class="absolute" style:width={box.width} style:height={box.height} style:left={box.left} style:top={box.top}>
    <AdaptiveImage
      {asset}
      {sharedLink}
      zoomDisabled={isOcrActive}
      imageClass={$slideshowState === SlideshowState.None ? 'object-contain' : slideshowLookCssMapping[$slideshowLook]}
      width={box.width}
      height={box.height}
      slideshowState={$slideshowState}
      slideshowLook={$slideshowLook}
      onImageReady={() => onReady?.()}
      onError={() => onReady?.()}
      bind:imgElement={$photoViewerImgElement}
    >
      {#snippet overlays()}
        <!-- eslint-disable-next-line svelte/require-each-key -->
        {#each getBoundingBox($boundingBoxesArray, $photoZoomState, $photoViewerImgElement) as boundingbox}
          <div
            class="absolute border-solid border-white border-3 rounded-lg"
            style="top: {boundingbox.top}px; left: {boundingbox.left}px; height: {boundingbox.height}px; width: {boundingbox.width}px;"
          ></div>
        {/each}

        {#each ocrBoxes as ocrBox (ocrBox.id)}
          <OcrBoundingBox {ocrBox} />
        {/each}
      {/snippet}
    </AdaptiveImage>

    {#if isFaceEditMode.value}
      <FaceEditor htmlElement={$photoViewerImgElement} {containerWidth} {containerHeight} assetId={asset.id} />
    {/if}
  </div>
</div>
