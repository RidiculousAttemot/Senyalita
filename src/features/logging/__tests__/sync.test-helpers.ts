import { resetTransport } from "../transport";
import { clearQueue, resetImportedFlag } from "../storage";
import { __resetSyncForTests } from "../sync";

export const resetSyncForTests = () => {
  resetTransport();
  clearQueue();
  resetImportedFlag();
  __resetSyncForTests();
};
