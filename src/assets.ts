import { AssetType, defineAssets } from '@iwsdk/core';
import { createFocusOrb } from './scene-assets/orb.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'focus-orb': createFocusOrb(),
  'tasks-panel': uikitml('tasks.uikitml', 'Tasks Panel'),
  'timer-panel': uikitml('timer.uikitml', 'Timer Panel'),
  'today-panel': uikitml('today.uikitml', 'Today Panel'),
});