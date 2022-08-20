export interface ActorNavigationContext {
  $recipeTypes: string[];
  url: string;
  $type: string;
}

export interface Title {
  textDirection: string;
  text: string;
  attributesV2: any[];
  accessibilityText: string;
  $recipeTypes: string[];
  $type: string;
}

export interface ShareViaMessageAction {
  message: string;
  $recipeTypes: string[];
  referringModuleKey: string;
  $type: string;
}

export interface ShareViaLinkAction {
  $recipeTypes: string[];
  url: string;
  $type: string;
}

export interface ReportAction {
  urn: string;
  contentSource: string;
  authorProfileId: string;
  $recipeTypes: string[];
  $type: string;
}

export interface ActionDetailsUnion {
  shareViaMessageAction: ShareViaMessageAction;
  shareViaLinkAction: ShareViaLinkAction;
  reportAction: ReportAction;
}

export interface DetailDataUnion {
  icon: string;
}

export interface Attribute {
  detailDataUnion: DetailDataUnion;
  $recipeTypes: string[];
  $type: string;
}

export interface Icon {
  attributes: Attribute[];
  $recipeTypes: string[];
  $type: string;
}

export interface Text {
  textDirection: string;
  text: string;
  attributesV2: any[];
  $recipeTypes: string[];
  $type: string;
}

export interface OverflowAction {
  searchActionType: string;
  actionDetailsUnion: ActionDetailsUnion;
  icon: Icon;
  text: Text;
  $recipeTypes: string[];
  $type: string;
}

export interface TargetUnion {
  updateV2Urn: string;
}

export type InsightsResolutionResults = {
  "*socialActivityCountsInsight": string;
}[];

export interface PrimarySubtitle {
  textDirection: string;
  text: string;
  attributesV2: any[];
  $recipeTypes: string[];
  $type: string;
}

export interface BadgeText {
  textDirection: string;
  text: string;
  attributesV2: any[];
  $recipeTypes: string[];
  $type: string;
}

export interface DetailDataUnion2 {
  style: string;
}

export interface AttributesV2 {
  detailDataUnion: DetailDataUnion2;
  start: number;
  length: number;
  $recipeTypes: string[];
  $type: string;
}

export interface Summary {
  textDirection: string;
  text: string;
  attributesV2: AttributesV2[];
  $recipeTypes: string[];
  $type: string;
}

export interface DetailData {
  "*profilePicture": string;
}

export interface DetailDataUnion3 {
  profilePicture: string;
}

export interface Attribute2 {
  detailData: DetailData;
  detailDataUnion: DetailDataUnion3;
  $recipeTypes: string[];
  $type: string;
}

export interface Image {
  attributes: Attribute2[];
  accessibilityText: string;
  $recipeTypes: string[];
  $type: string;
}

export interface DetailDataUnion4 {
  icon: string;
}

export interface AttributesV22 {
  detailDataUnion: DetailDataUnion4;
  start: number;
  length: number;
  $recipeTypes: string[];
  $type: string;
}

export interface SecondarySubtitle {
  textDirection: string;
  text: string;
  attributesV2: AttributesV22[];
  $recipeTypes: string[];
  $type: string;
}

export interface Insight {
  socialActivityCountsInsight: string;
}

export interface ImageUrl {
  $recipeTypes: string[];
  url: string;
  $type: string;
}

export interface Artifact {
  width: number;
  $recipeTypes: string[];
  fileIdentifyingUrlPathSegment: string;
  expiresAt: any;
  height: number;
  $type: string;
}

export interface VectorImage {
  $recipeTypes: string[];
  rootUrl: string;
  artifacts: Artifact[];
  $type: string;
}

export interface DetailDataUnion5 {
  imageUrl: ImageUrl;
  vectorImage: VectorImage;
}

export interface Attribute3 {
  detailDataUnion: DetailDataUnion5;
  $recipeTypes: string[];
  scalingType: string;
  $type: string;
}

export interface Image2 {
  attributes: Attribute3[];
  $recipeTypes: string[];
  $type: string;
  accessibilityTextAttributes: any[];
  accessibilityText: string;
}

export interface Title2 {
  textDirection: string;
  text: string;
  attributesV2: any[];
  $recipeTypes: string[];
  $type: string;
}

export interface PrimarySubtitle2 {
  textDirection: string;
  text: string;
  $recipeTypes: string[];
  $type: string;
}

export interface EntityEmbeddedObject {
  image: Image2;
  showPlayButton: boolean;
  title: Title2;
  $recipeTypes: string[];
  $type: string;
  primarySubtitle: PrimarySubtitle2;
}

export interface NavigationContext {
  $recipeTypes: string[];
  url: string;
  $type: string;
}

export interface PostEntity {
  template: string;
  actorNavigationContext: ActorNavigationContext;
  trackingUrn: string;
  controlName?: any;
  interstitialComponent?: any;
  primaryActions?: any;
  entityCustomTrackingInfo?: any;
  title: Title;
  overflowActions: OverflowAction[];
  targetUnion: TargetUnion;
  searchActionType?: any;
  insightsResolutionResults: InsightsResolutionResults;
  badgeIcon?: any;
  entityUrn: string;
  showAdditionalCluster?: any;
  lazyLoadedActionsUrn?: any;
  ringStatus?: any;
  primarySubtitle: PrimarySubtitle;
  badgeText: BadgeText;
  trackingId: string;
  actorNavigationUrl: string;
  summary: Summary;
  addEntityToSearchHistory?: any;
  image: Image;
  secondarySubtitle: SecondarySubtitle;
  insights: Insight[];
  navigationUrl: string;
  entityEmbeddedObject: EntityEmbeddedObject;
  $recipeTypes: string[];
  $type: string;
  unreadIndicatorDetailsUnion?: any;
  actorTrackingUrn: string;
  navigationContext: NavigationContext;
}
