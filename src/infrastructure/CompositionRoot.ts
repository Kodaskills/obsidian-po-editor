import {
  ConvertFromFormat,
  ConvertToFormat,
  ConverterRegistry,
  CreatePO,
  type FileReader,
  type FileWriter,
  type IPOFileIO,
  POFileMutationService,
  type Notifier,
  ParsePO,
  SyncPOFiles,
  ValidatePO,
  type ViewNavigator,
  POStateStore,
} from "@application/index";
import { ObsidianViewNavigator, POViewController } from "@presentation/index";
import { type App } from "obsidian";

import { ObsidianNotifier } from "../presentation/adapters/ObsidianNotifier";
import { ObsidianFileAccess } from "./adapters/ObsidianFileAccess";
import { POFileIO as POFileIOImpl } from "./adapters/POFileIO";
import { ARBEnhancedConverter } from "./converters/ARBEnhancedConverter";
import { ICUConverter } from "./converters/ICUConverter";
import { JsonConverter, YamlConverter } from "./converters/JsonYamlConverter";
import { POConverter } from "./converters/POConverter";
import { XLIFFConverter } from "./converters/XLIFFConverter";

export class CompositionRoot {
  readonly fileAdapter: ObsidianFileAccess;
  readonly notificationAdapter: Notifier;
  readonly viewAdapter: ViewNavigator;
  readonly poConverter: POConverter;
  readonly registry: ConverterRegistry;
  readonly createPOUseCase: CreatePO;
  readonly parsePOUseCase: ParsePO;
  readonly validatePOUseCase: ValidatePO;
  readonly convertToFormatUseCase: ConvertToFormat;
  readonly convertFromFormatUseCase: ConvertFromFormat;
  readonly syncPOFilesUseCase: SyncPOFiles;
  readonly mutationService: POFileMutationService;
  readonly poViewController: POViewController;
  readonly poFileIO: IPOFileIO;
  readonly poStateStore: POStateStore;

  get fileReaderPort(): FileReader {
    return this.fileAdapter;
  }

  get fileWriterPort(): FileWriter {
    return this.fileAdapter;
  }

  constructor(app: App) {
    this.fileAdapter = new ObsidianFileAccess(app);
    this.notificationAdapter = new ObsidianNotifier();
    this.viewAdapter = new ObsidianViewNavigator(app);

    this.poConverter = new POConverter();

    this.registry = new ConverterRegistry();
    for (const converter of [
      this.poConverter,
      new XLIFFConverter(),
      new ARBEnhancedConverter(),
      new JsonConverter(),
      new YamlConverter(),
      new ICUConverter(),
    ]) {
      this.registry.register(converter);
    }

    this.createPOUseCase = new CreatePO();
    this.parsePOUseCase = new ParsePO();
    this.validatePOUseCase = new ValidatePO();
    this.convertToFormatUseCase = new ConvertToFormat(this.registry);
    this.convertFromFormatUseCase = new ConvertFromFormat(this.registry);
    this.syncPOFilesUseCase = new SyncPOFiles();

    this.mutationService = new POFileMutationService();
    this.poStateStore = new POStateStore();

    this.poFileIO = new POFileIOImpl(this.fileAdapter);

    this.poViewController = new POViewController(
      this.parsePOUseCase,
      this.syncPOFilesUseCase,
      this.convertToFormatUseCase,
      this.poConverter,
      this.mutationService,
    );
  }
}
