import { getChannel, QUEUE_DOCUMENT_UPLOADED } from "./rabbitmq";

export async function publishDocumentUploaded(payload: { documentId: string }) {
  const ch = await getChannel();
  ch.sendToQueue(QUEUE_DOCUMENT_UPLOADED, Buffer.from(JSON.stringify(payload)), {
    contentType: "application/json",
    persistent: true,
  });
}

