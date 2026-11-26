import type { Run } from '../../communication/engine';
import type { Role, Story } from '../../communication/types';
import { alice } from './alice';
import { alex } from './alex';
import { alice as oldAlice } from './aliceLegacy';
import { alex as oldAlex } from './alexLegacy';

export const stories: Record<Role, Story> = { male: alice, female: alex };
export const legacyStories: Record<Role, Story> = { male: oldAlice, female: oldAlex };

export function storyFor(run: Run) {
  return (run.version === 2 ? stories : legacyStories)[run.role];
}
