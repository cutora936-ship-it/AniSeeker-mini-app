import type { Role, Story } from '../../communication/types';
import { alice } from './alice';
import { alex } from './alex';

export const stories: Record<Role, Story> = { male: alice, female: alex };
