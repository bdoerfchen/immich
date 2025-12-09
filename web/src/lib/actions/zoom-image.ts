import { photoZoomState } from '$lib/stores/zoom-image.store';
import { createZoomImageWheel } from '@zoom-image/core';
import { get } from 'svelte/store';

export const zoomImageAction = (node: HTMLElement, options?: { disabled?: boolean }) => {
  const state = get(photoZoomState);
  const zoomInstance = createZoomImageWheel(node, {
    maxZoom: 10,
    initialState: state,
  });

  const unsubscribes = [
    photoZoomState.subscribe((state) => zoomInstance.setState(state)),
    zoomInstance.subscribe(({ state }) => {
      photoZoomState.set(state);
    }),
  ];

  const wheelHandler = (event: WheelEvent) => {
    if (options?.disabled) {
      event.stopImmediatePropagation();
    }
  };

  const pointerDownHandler = (event: PointerEvent) => {
    if (options?.disabled) {
      event.stopImmediatePropagation();
    }
  };

  node.addEventListener('wheel', wheelHandler, { capture: true });
  node.addEventListener('pointerdown', pointerDownHandler, { capture: true });

  node.style.overflow = 'visible';
  return {
    update(newOptions?: { disabled?: boolean }) {
      options = newOptions;
    },
    destroy() {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
      node.removeEventListener('wheel', wheelHandler, { capture: true });
      node.removeEventListener('pointerdown', pointerDownHandler, { capture: true });
      zoomInstance.cleanup();
    },
  };
};
