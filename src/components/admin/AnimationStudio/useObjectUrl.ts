"use client";

import { useEffect, useState } from "react";

/**
 * An object URL owned by the component that uses it.
 *
 * The studio used to pass one URL between tabs: VideoUploadTab created it,
 * put it on VideoMetadata, and the extract and preview tabs rendered
 * `<video src={videoMeta.url}>`. But the parent renders tabs conditionally, so
 * moving to the extract tab UNMOUNTS the upload tab -- and its cleanup revokes
 * that exact URL. Extraction then loaded a dead blob and failed with
 * ERR_FILE_NOT_FOUND, while `duration` and the dimensions still looked correct
 * because they had been copied into state before the revoke. A handoff whose
 * sender destroys the thing it handed over.
 *
 * Deriving the URL from the File instead makes the consumer the owner: it
 * lives exactly as long as the component that renders it, and no other tab's
 * lifecycle can invalidate it.
 */
export function useObjectUrl(file: File | null | undefined): string {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const created = URL.createObjectURL(file);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [file]);

  return url;
}
