/**
 * A space's site built and put where it is served: the SPA shell and its fingerprint, the versions a build
 * bakes in, a site as a zip and back, and the uploaders a self-hoster's deployment or the CLI hands a credential —
 * an S3 bucket (AWS, R2, any storage that speaks its API) with CloudFront, an FTP host, a folder — and a site
 * prerendered from any page server. A server that never deploys never
 * loads it.
 */
export { signAws, awsFetch, awsEncode, awsRefusal } from './deploy/aws/sigv4';
export { invalidateCloudFront, objectUrl, pointCloudFront, putFiles, putObject, s3Uploader } from './deploy/aws/s3';
export { contentTypeOf } from './deploy/contentType';
export { digestOf, fingerprintChanges, fingerprintOf } from './deploy/fingerprint';
export { folderUploader } from './deploy/folder';
export { ftpUploader, passiveAddress } from './deploy/ftp';
export { buildVersions, sdkFiles } from './deploy/sdkFiles';
export { buildSpaShell, spaFingerprintParts } from './deploy/spaShell';
export { buildStaticSite, cssFilesOf, fileOf, linksOf } from './deploy/staticSite';
export { unzipFiles, zipFiles } from './deploy/zip';
export type { AwsCredentials, AwsRequest } from './deploy/aws/sigv4';
export type { CloudFrontTarget, S3Target } from './deploy/aws/s3';
export type { FtpTarget } from './deploy/ftp';
export type { SdkFiles } from './deploy/sdkFiles';
export type { FetchedPage, StaticSite, StaticSiteInput } from './deploy/staticSite';
export type { SpaServers, SpaShellInput } from './deploy/spaShell';
export type {
  BuildVersions,
  BuiltSite,
  DeployLog,
  FingerprintParts,
  SiteFile,
  SiteUploader,
  UploadResult
} from './deploy/types';
