import { type POFile } from "@domain/index";

export interface POConverterPort {
  compile(poFile: POFile): string;
  parse(content: string): POFile;
}
