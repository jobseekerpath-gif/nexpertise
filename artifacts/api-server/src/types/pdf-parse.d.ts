declare module "pdf-parse/lib/pdf-parse.js" {
  function PdfParse(dataBuffer: Buffer, options?: { max?: number; pagerender?: (pageData: unknown) => string | Promise<string> }): Promise<{
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: string;
    text: string;
  }>;
  export default PdfParse;
}
