declare module "docxtemplater-image-module-free" {
  type ImageOptions = {
    centered?: boolean;
    getImage: (tagValue: unknown, tagName: string) => ArrayBuffer | Uint8Array;
    getSize: (
      img: ArrayBuffer | Uint8Array,
      tagValue: unknown,
      tagName: string,
    ) => [number, number];
  };
  export default class ImageModule {
    constructor(options: ImageOptions);
  }
}
