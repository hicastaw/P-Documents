import { getChannel, QUEUE_DOCUMENT_UPLOADED } from "../config/queue";

export async function publishDocumentUploaded(payload: { documentId: string }) {
  const ch = await getChannel();
  ch.sendToQueue(QUEUE_DOCUMENT_UPLOADED, Buffer.from(JSON.stringify(payload)), {
    contentType: "application/json",
    persistent: true,
  });
}
