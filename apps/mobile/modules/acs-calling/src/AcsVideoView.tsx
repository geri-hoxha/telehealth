import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { AcsVideoViewProps } from './AcsCalling.types';

/** Shows the local camera or the remote participant's video of the current call. */
export const AcsVideoView: ComponentType<AcsVideoViewProps> = requireNativeView('AcsCalling');
