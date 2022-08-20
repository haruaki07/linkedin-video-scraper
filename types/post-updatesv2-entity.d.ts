export interface Artifact {
  width: number;
  fileIdentifyingUrlPathSegment: string;
  expiresAt: number;
  height: number;
  $type: string;
}

export interface Thumbnail {
  artifacts: Artifact[];
  rootUrl: string;
  $type: string;
}

export interface StreamingLocation {
  url: string;
  expiresAt: any;
  $type: string;
}

export interface ProgressiveStream {
  streamingLocations: StreamingLocation[];
  size: number;
  bitRate: number;
  width: number;
  mediaType: string;
  height: number;
  $type: string;
}

export interface MasterPlaylist {
  url: string;
  expiresAt: number;
  $type: string;
}

export interface AdaptiveStream {
  initialBitRate: number;
  protocol: string;
  mediaType: string;
  masterPlaylists: MasterPlaylist[];
  $type: string;
}

export interface Artifact2 {
  width: number;
  fileIdentifyingUrlPathSegment: string;
  expiresAt: number;
  height: number;
  $type: string;
}

export interface FirstFrameThumbnail {
  artifacts: Artifact2[];
  rootUrl: string;
  $type: string;
}

export interface PostUpdatesV2MediaEntity {
  thumbnail: Thumbnail;
  progressiveStreams: ProgressiveStream[];
  liveStreamCreatedAt?: any;
  transcripts: any[];
  prevMedia?: any;
  aspectRatio: number;
  media: string;
  adaptiveStreams: AdaptiveStream[];
  $type: string;
  liveStreamEndedAt?: any;
  duration: number;
  entityUrn: string;
  provider: string;
  firstFrameThumbnail: FirstFrameThumbnail;
  nextMedia?: any;
  thumbnails?: any;
  trackingId: string;
}
